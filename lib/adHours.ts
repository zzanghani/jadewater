// 시간·요일 분석 (운영관리 앱 "시간·요일" 탭): 토스 시간대 매출(by_hour) × 네이버 시간대 광고비(ad_hourly_stats), 최근 28일.
import { addYmd } from "@/lib/adReport";

export const WD_LABEL = ["일", "월", "화", "수", "목", "금", "토"];
const wdOf = (ymd: string) => new Date(ymd + "T00:00:00Z").getUTCDay();

export type HourRow = { hour: number; sales: number; cost: number; clk: number; imp: number; roas: number | null; salesShare: number; costShare: number };
export type HoursAnalysis = {
  from: string;
  to: string;
  days: number; // 매출 자료가 있는 날 수
  openHours: number[]; // 추정 영업시간 (매출이 실제로 찍히는 시간대)
  hours: HourRow[]; // 영업시간 ± 2시간 범위
  heat: { wd: number; label: string; days: number; cells: { hour: number; avg: number }[] }[]; // 요일×시간 영업일 평균 매출
  heatMax: number;
  weekday: { wd: number; label: string; days: number; adDays: number; sales: number; cost: number; clk: number; roas: number | null; cpc: number | null; lowEff: boolean }[];
  /** 시간대 광고비 자료가 있는 날 수 (네이버는 최근 7일만 시간대 분해를 준다) */
  adHourDays: number;
  peakHours: number[]; // 매출 상위 3시간
  adFocusHours: number[]; // 광고 몰아야 할 시간 = 피크 1~3시간 전
  outsideCost: number; // 영업시간 밖 광고비
  outsidePct: number | null;
  lowEffHours: number[]; // 광고비 비중은 높은데 매출 비중은 낮은 시간
  notes: string[]; // 운영 방향 문장
  adConnected: boolean;
};

export function analyzeHours(input: {
  from: string;
  to: string;
  sales: { date: string; by_hour: Record<string, number> | null; sales: number }[];
  ad: { date: string; hour: number; imp: number; clk: number; cost: number }[];
  /** 일별 광고 성과(28일) — 요일별 광고비는 이걸로 (시간대 자료는 네이버가 최근 7일만 줌) */
  adDaily?: { date: string; cost: number; clk: number }[];
  adConnected: boolean;
}): HoursAnalysis {
  const { from, to } = input;
  const salesH = Array(24).fill(0) as number[];
  const costH = Array(24).fill(0) as number[];
  const clkH = Array(24).fill(0) as number[];
  const impH = Array(24).fill(0) as number[];
  const heatSum: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const wdDays = Array(7).fill(0) as number[];
  const wdSales = Array(7).fill(0) as number[];
  const wdCost = Array(7).fill(0) as number[];
  const wdClk = Array(7).fill(0) as number[];
  let days = 0;
  const salesDates = new Set<string>();
  for (const r of input.sales) {
    if (!r.by_hour) continue;
    days++;
    salesDates.add(r.date);
    const w = wdOf(r.date);
    wdDays[w]++;
    for (const [h, v] of Object.entries(r.by_hour)) {
      const hh = Number(h);
      if (!Number.isFinite(hh) || hh < 0 || hh > 23) continue;
      salesH[hh] += v;
      heatSum[w][hh] += v;
      wdSales[w] += v;
    }
  }
  const adDates = new Set<string>();
  for (const r of input.ad) {
    if (r.cost > 0 || r.clk > 0) adDates.add(r.date);
    costH[r.hour] += r.cost;
    clkH[r.hour] += r.clk;
    impH[r.hour] += r.imp;
  }
  const wdAdDays = Array(7).fill(0) as number[];
  for (const r of input.adDaily ?? []) {
    const w = wdOf(r.date);
    wdCost[w] += r.cost;
    wdClk[w] += r.clk;
    wdAdDays[w]++;
  }
  const totalSales = salesH.reduce((a, b) => a + b, 0);
  const totalCost = costH.reduce((a, b) => a + b, 0);

  // 영업시간 추정: 전체 매출의 1% 이상 찍히는 시간대 (앞뒤로 이어 붙임)
  const openHours: number[] = [];
  {
    const hit: number[] = [];
    for (let h = 0; h < 24; h++) if (totalSales > 0 && salesH[h] / totalSales >= 0.01) hit.push(h);
    // 첫 시간~마지막 시간을 빈틈없이 영업시간으로 본다 (브레이크타임도 영업 중)
    if (hit.length) for (let h = hit[0]; h <= hit[hit.length - 1]; h++) openHours.push(h);
  }
  const lo = openHours.length ? Math.max(0, openHours[0] - 2) : 9;
  const hi = openHours.length ? Math.min(23, openHours[openHours.length - 1] + 2) : 22;
  const hours: HourRow[] = [];
  for (let h = lo; h <= hi; h++) {
    hours.push({ hour: h, sales: Math.round(salesH[h]), cost: Math.round(costH[h]), clk: clkH[h], imp: impH[h], roas: salesH[h] && costH[h] ? (salesH[h] / costH[h]) * 100 : null, salesShare: totalSales ? salesH[h] / totalSales : 0, costShare: totalCost ? costH[h] / totalCost : 0 });
  }

  // 요일×시간 히트맵 (영업일 평균)
  const order = [1, 2, 3, 4, 5, 6, 0];
  let heatMax = 0;
  const heat = order.map((w) => {
    const cells = [];
    for (let h = lo; h <= hi; h++) {
      const avg = wdDays[w] ? heatSum[w][h] / wdDays[w] : 0;
      if (avg > heatMax) heatMax = avg;
      cells.push({ hour: h, avg: Math.round(avg) });
    }
    return { wd: w, label: WD_LABEL[w], days: wdDays[w], cells };
  });

  // 요일별 성과
  const wdRoasList = order.map((w) => (wdSales[w] && wdCost[w] ? wdSales[w] / wdCost[w] : null)).filter((v): v is number => v != null);
  const avgRoas = wdRoasList.length ? wdRoasList.reduce((a, b) => a + b, 0) / wdRoasList.length : null;
  const weekday = order.map((w) => {
    const roas = wdSales[w] && wdCost[w] ? (wdSales[w] / wdCost[w]) * 100 : null;
    return { wd: w, label: WD_LABEL[w], days: wdDays[w], adDays: wdAdDays[w], sales: Math.round(wdSales[w]), cost: Math.round(wdCost[w]), clk: wdClk[w], roas, cpc: wdClk[w] ? wdCost[w] / wdClk[w] : null, lowEff: !!(roas != null && avgRoas != null && roas / 100 < avgRoas * 0.6 && wdDays[w] >= 2) };
  });

  // 피크·광고 집중 시간
  const peakHours = [...hours].sort((a, b) => b.sales - a.sales).slice(0, 3).map((h) => h.hour).sort((a, b) => a - b);
  const adFocusHours = Array.from(new Set(peakHours.flatMap((h) => [h - 2, h - 1]).filter((h) => h >= 0))).sort((a, b) => a - b);
  const openSet = new Set(openHours);
  const outsideCost = Math.round(costH.reduce((s, v, h) => s + (openSet.has(h) ? 0 : v), 0));
  const outsidePct = totalCost ? (outsideCost / totalCost) * 100 : null;
  const lowEffHours = hours.filter((h) => h.costShare >= 0.08 && h.salesShare < h.costShare * 0.5 && h.cost > 0).map((h) => h.hour);

  const notes: string[] = [];
  const hr = (h: number) => `${h}시`;
  const rangeTxt = (list: number[]) => (list.length ? `${hr(list[0])}~${hr(list[list.length - 1] + 1)}` : "-");
  if (peakHours.length) notes.push(`매출이 가장 많은 시간은 ${peakHours.map(hr).join("·")}. 검색은 식사 1~3시간 전에 하니 광고는 ${rangeTxt(adFocusHours)}에 몰아 두는 게 좋아요.`);
  if (input.adConnected && outsidePct != null && outsidePct >= 10) notes.push(`광고비의 ${outsidePct.toFixed(0)}%(${outsideCost.toLocaleString("ko-KR")}원, 최근 ${adDates.size}일)가 영업시간(${rangeTxt(openHours)}) 밖에 나갔어요. 네이버 광고주 사이트에서 노출 시간을 영업시간 전후로 맞추면 아낄 수 있어요.`);
  // 광고비가 특정 시간에 몰려 있으면 알려준다 (운영관리 앱 "17시 한 시간에 90% 소진" 진단)
  const topCost = [...hours].sort((a, b) => b.cost - a.cost)[0];
  if (input.adConnected && topCost && totalCost > 0 && topCost.costShare >= 0.5) notes.push(`광고비의 ${(topCost.costShare * 100).toFixed(0)}%가 ${hr(topCost.hour)} 한 시간에 몰려 있어요(하루 예산이 그 시간에 다 소진). 입찰가를 낮추거나 노출 시간을 ${rangeTxt(adFocusHours)}로 옮기면 하루 종일 고르게 나가요.`);
  if (lowEffHours.length) notes.push(`${lowEffHours.map(hr).join("·")}는 광고비 비중에 비해 매출 비중이 절반도 안 돼요. 이 시간대 입찰가를 낮춰 보세요.`);
  const low = weekday.filter((w) => w.lowEff);
  if (low.length) notes.push(`${low.map((w) => w.label).join("·")}요일은 광고비 대비 매출이 평균의 60% 아래예요. 그 요일 입찰가를 낮추거나 예산을 줄여 보세요.`);
  if (!input.adConnected) notes.push("네이버 광고 계정이 연결되면 시간대별 광고비·효율도 같이 보여요.");
  if (days === 0) notes.push("토스 시간대 매출이 아직 없어요. 효율 분석에서 '최근 8주 동기화'를 눌러 주세요.");

  return { from, to, days, openHours, hours, heat, heatMax, weekday, peakHours, adFocusHours, outsideCost, outsidePct, lowEffHours, notes, adConnected: input.adConnected, adHourDays: adDates.size };
}

export const hoursRange = (today: string) => ({ from: addYmd(today, -28), to: addYmd(today, -1) });
