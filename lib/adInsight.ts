// 광고 효율 분석 — 토스 일매출 × 네이버 일별 광고 성과.
// 동기화(sync*)는 서비스 키로 두 API에서 받아 테이블에 쌓고, 분석(analyze)은 쌓인 날짜 행만으로 계산한다.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { callNaver, pool, STAT_FIELDS, type NaverAcct, type NaverStatRow } from "@/lib/naverAds";
import { fetchTossClosing } from "@/lib/tossClosing";
import type { TossKeys } from "@/lib/tossPlace";
import { addYmd, HOLIDAYS, pctDelta, weekdayIndex, type SalesMap } from "@/lib/adReport";
import { HEAVY_RAIN_MM, RAIN_MM } from "@/lib/weather";

type Service = SupabaseClient<Database>;

export type DailyRow = {
  date: string;
  sales: number | null; // 토스 없으면 null
  orders: number | null;
  imp: number;
  clk: number;
  cost: number;
  conv: number;
  /** 강수량 mm (날씨 없으면 null) */
  rain?: number | null;
  holiday?: boolean;
  /** 특이일 메모 (행사·휴무 등) */
  special?: string | null;
};

/* ---------- 동기화 ---------- */
// 토스: 날짜마다 주문 목록을 읽어 집계한다. 지난 날은 바뀌지 않으니 없는 날 + 최근 2일만.
export async function syncTossDaily(
  service: Service,
  storeId: string,
  keys: TossKeys,
  merchantId: string,
  from: string,
  to: string,
  { force = false, maxDays = 35 } = {}
): Promise<number> {
  // 시간대(by_hour)가 아직 없는 옛 행은 다시 받아 채운다 (마감 추정에 필요).
  const { data: have } = await service.from("toss_daily_sales").select("date, by_hour").eq("store_id", storeId).gte("date", from).lte("date", to);
  const haveSet = new Set((have ?? []).filter((r) => r.by_hour != null).map((r) => r.date));
  let days: string[] = [];
  for (let d = from; d <= to; d = addYmd(d, 1)) if (force || !haveSet.has(d) || d >= addYmd(to, -1)) days.push(d);
  // 한 번에 너무 많으면(옛 자료 다시 받기) 최근 날짜부터 maxDays만 — 나머지는 다음 동기화·크론이 채운다
  if (days.length > maxDays) days = days.slice(-maxDays);
  let n = 0;
  await pool(days, 3, async (d) => {
    const c = await fetchTossClosing(keys, merchantId, d);
    await service.from("toss_daily_sales").upsert(
      {
        store_id: storeId,
        date: d,
        sales: c.paid,
        orders: c.orders,
        card: c.payments.CARD ?? 0,
        cash: c.payments.CASH ?? 0,
        easypay: c.payments.BARCODE ?? 0,
        external: c.payments.EXTERNAL ?? 0,
        delivery: c.delivery.amount,
        discount: c.discount,
        by_hour: c.byHour,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "store_id,date" }
    );
    // 메뉴별 판매도 같이 쌓는다 (그날 행은 통째로 갈아끼움)
    const itemRows = Object.entries(c.items).map(([name, v]) => ({ store_id: storeId, date: d, name: name.slice(0, 120), category: v.category.slice(0, 60), qty: v.qty, amount: v.amount, orders: v.orders, synced_at: new Date().toISOString() }));
    await service.from("toss_daily_items").delete().eq("store_id", storeId).eq("date", d);
    if (itemRows.length) await service.from("toss_daily_items").upsert(itemRows, { onConflict: "store_id,date,name" });
    n++;
  });
  return n;
}

// 네이버: 캠페인별 일별 stats를 받아 날짜로 합친다 (최대 31일).
export async function syncAdDaily(service: Service, storeId: string, acct: NaverAcct, from: string, to: string): Promise<number> {
  const camps = ((await callNaver<{ nccCampaignId: string; status?: string }[]>(acct, "/ncc/campaigns")) ?? []).filter((c) => c.status !== "DELETED");
  const daily: Record<string, { imp: number; clk: number; cost: number; conv: number }> = {};
  await pool(camps, 3, async (c) => {
    const d = await callNaver<{ data?: NaverStatRow[] }>(acct, "/stats", {
      id: c.nccCampaignId,
      fields: STAT_FIELDS,
      timeRange: JSON.stringify({ since: from, until: to }),
      timeIncrement: "1",
    }).catch(() => null);
    for (const r of d?.data ?? []) {
      const k = String(r.dateStart ?? "").slice(0, 10);
      if (!k) continue;
      const x = (daily[k] ??= { imp: 0, clk: 0, cost: 0, conv: 0 });
      x.imp += r.impCnt ?? 0;
      x.clk += r.clkCnt ?? 0;
      x.cost += r.salesAmt ?? 0;
      x.conv += r.ccnt ?? 0;
    }
  });
  const rows = [];
  for (let d = from; d <= to; d = addYmd(d, 1)) {
    const x = daily[d] ?? { imp: 0, clk: 0, cost: 0, conv: 0 };
    rows.push({ store_id: storeId, date: d, imp: x.imp, clk: x.clk, cost: Math.round(x.cost), conv: x.conv, synced_at: new Date().toISOString() });
  }
  if (rows.length) await service.from("ad_daily_stats").upsert(rows, { onConflict: "store_id,date" });
  return rows.length;
}

// 네이버: 시간대(hh24)별 성과. 네이버 stats는 breakdown을 timeIncrement=allDays에서만 적용하므로
// 캠페인×날짜마다 한 번씩(그날 전체를 시간대로 쪼개) 받아 합친다. 호출이 많아 하루 단위로 끊어 쓴다.
export async function syncAdHourly(service: Service, storeId: string, acct: NaverAcct, from: string, to: string): Promise<number> {
  const camps = ((await callNaver<{ nccCampaignId: string; status?: string }[]>(acct, "/ncc/campaigns")) ?? []).filter((c) => c.status !== "DELETED");
  type HRow = NaverStatRow & { hh24?: number | string; breakdownValue?: string | number };
  const days: string[] = [];
  for (let d = from; d <= to; d = addYmd(d, 1)) days.push(d);
  const jobs = days.flatMap((d) => camps.map((c) => ({ d, c })));
  const agg: Record<string, { imp: number; clk: number; cost: number; conv: number }> = {};
  const okDays = new Set<string>();
  await pool(jobs, 4, async ({ d, c }) => {
    const r = await callNaver<{ data?: HRow[] }>(acct, "/stats", {
      id: c.nccCampaignId,
      fields: STAT_FIELDS,
      timeRange: JSON.stringify({ since: d, until: d }),
      timeIncrement: "allDays",
      breakdown: "hh24",
    }).catch(() => null);
    if (!r) return;
    okDays.add(d);
    for (const row of r.data ?? []) {
      const hv = row.hh24 ?? row.breakdownValue;
      const hour = Number(hv);
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
      const x = (agg[`${d}|${hour}`] ??= { imp: 0, clk: 0, cost: 0, conv: 0 });
      x.imp += row.impCnt ?? 0;
      x.clk += row.clkCnt ?? 0;
      x.cost += row.salesAmt ?? 0;
      x.conv += row.ccnt ?? 0;
    }
  });
  const rows = [];
  for (const d of okDays)
    for (let h = 0; h < 24; h++) {
      const x = agg[`${d}|${h}`] ?? { imp: 0, clk: 0, cost: 0, conv: 0 };
      rows.push({ store_id: storeId, date: d, hour: h, imp: x.imp, clk: x.clk, cost: Math.round(x.cost), conv: x.conv, synced_at: new Date().toISOString() });
    }
  for (let i = 0; i < rows.length; i += 500) await service.from("ad_hourly_stats").upsert(rows.slice(i, i + 500), { onConflict: "store_id,date,hour" });
  return okDays.size;
}

/* ---------- 분석 ---------- */
export type PeriodStat = {
  sales: number;
  salesDays: number;
  cost: number;
  clk: number;
  conv: number;
  roas: number | null; // 매출 / 광고비 × 100
  adShare: number | null; // 광고비 / 매출 × 100
  cpc: number | null;
  cpa: number | null;
};
export type AdInsight = {
  storeId: string;
  storeName: string;
  today: { date: string; sales: number | null; orders: number | null; cost: number; clk: number; conv: number; roas: number | null; lastPayAt: string | null };
  week: PeriodStat; // 최근 7일(어제까지)
  weekPrev: PeriodStat;
  month: PeriodStat; // 최근 28일
  monthPrev: PeriodStat;
  salesNorm: number | null; // 최근 7일 매출 ÷ 평소(요일 보정)
  weekday: { label: string; sales: number; cost: number; roas: number | null; days: number }[]; // 최근 28일 요일별
  series: DailyRow[]; // 최근 28일 (오늘 포함)
  findings: { sev: "bad" | "warn" | "good" | "info"; text: string }[];
  convTracked: boolean;
  /** 네이버 광고 계정이 연결돼 광고비 데이터가 있는지 */
  adConnected: boolean;
  /** 날씨·공휴일·특이일 보정 */
  weather: {
    rainyDays7: number; // 최근 7일 중 비(1mm↑) 온 날
    excluded7: number; // 최근 7일 중 비교에서 뺀 날(큰비·공휴일·특이일)
    rainEffect: number | null; // 비 오는 날 매출 ÷ 맑은 날 매출 − 1 (요일 보정, 지난 1년)
    adjNorm: number | null; // 큰비·공휴일·특이일을 뺀 평소 대비
    hasWeather: boolean;
  };
  specialDays: { date: string; note: string }[];
  /** 광고 손익분기 (원가율 기준) */
  breakeven: {
    costRate: number;
    minRoas: number; // 광고비가 이익을 못 넘기는 선 = 100 ÷ (1 − 원가율)
    neededPer10k: number; // 광고비 1만원 늘릴 때 필요한 매출
    weekProfit: number | null; // 최근 7일: 매출×(1−원가율) − 광고비 … 광고가 남긴 이익(광고비까지 뺀 뒤)
  };
};

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const wdOf = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
function period(rows: DailyRow[]): PeriodStat {
  const withSales = rows.filter((r) => r.sales != null);
  const sales = withSales.reduce((s, r) => s + (r.sales ?? 0), 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const clk = rows.reduce((s, r) => s + r.clk, 0);
  const conv = rows.reduce((s, r) => s + r.conv, 0);
  // 매출이 있는 날의 광고비만으로 ROAS를 계산해야 비교가 공정하다
  const costOnSalesDays = withSales.reduce((s, r) => s + r.cost, 0);
  return {
    sales,
    salesDays: withSales.length,
    cost,
    clk,
    conv,
    roas: sales && costOnSalesDays ? (sales / costOnSalesDays) * 100 : null,
    adShare: sales ? (costOnSalesDays / sales) * 100 : null,
    cpc: clk ? cost / clk : null,
    cpa: conv ? cost / conv : null,
  };
}
export const won = (n: number | null | undefined) => (n == null || !isFinite(n) ? "-" : Math.round(n).toLocaleString("ko-KR"));
const dTxt = (d: number | null) => (d == null ? "-" : (d > 0 ? "+" : "") + d.toFixed(0) + "%");

export function analyze(input: {
  storeId: string;
  storeName: string;
  today: string;
  rows: DailyRow[]; // 날짜 오름차순, 오늘 포함 가능
  yearSales: SalesMap; // 평소 대비 계산용(지난 1년 토스 또는 마감 매출)
  todayLive: { sales: number | null; orders: number | null; lastPayAt: string | null };
  adConnected: boolean;
  weather?: Record<string, number>; // 'YYYY-MM-DD' → 강수량 mm
  specials?: Record<string, string>; // 'YYYY-MM-DD' → 특이일 메모
  costRate?: number;
}): AdInsight {
  const { today } = input;
  const weather = input.weather ?? {};
  const specials = input.specials ?? {};
  const hasWeather = Object.keys(weather).length > 0;
  const costRate = input.costRate ?? 0.35;
  // 비교에서 뺄 날: 큰비·공휴일·특이일
  const excluded = (d: string) => HOLIDAYS.has(d) || specials[d] != null || (weather[d] ?? 0) >= HEAVY_RAIN_MM;
  const byDate = new Map(input.rows.map((r) => [r.date, r]));
  const range = (from: string, to: string) => {
    const out: DailyRow[] = [];
    for (let d = from; d <= to; d = addYmd(d, 1)) {
      const r = byDate.get(d) ?? { date: d, sales: null, orders: null, imp: 0, clk: 0, cost: 0, conv: 0 };
      out.push({ ...r, rain: hasWeather ? weather[d] ?? null : null, holiday: HOLIDAYS.has(d), special: specials[d] ?? null });
    }
    return out;
  };
  const y = addYmd(today, -1);
  const week = range(addYmd(y, -6), y);
  const weekPrev = range(addYmd(y, -13), addYmd(y, -7));
  const month = range(addYmd(y, -27), y);
  const monthPrev = range(addYmd(y, -55), addYmd(y, -28));
  const W = period(week);
  const WP = period(weekPrev);
  const M = period(month);
  const MP = period(monthPrev);

  // 요일별 (최근 28일)
  const wdAgg = Array.from({ length: 7 }, (_, i) => ({ label: WD[i], sales: 0, cost: 0, days: 0 }));
  for (const r of month) if (r.sales != null) {
    const a = wdAgg[wdOf(r.date)];
    a.sales += r.sales;
    a.cost += r.cost;
    a.days++;
  }
  const weekday = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ ...wdAgg[i], roas: wdAgg[i].sales && wdAgg[i].cost ? (wdAgg[i].sales / wdAgg[i].cost) * 100 : null }));

  // 평소 대비 (요일·공휴일 보정): 최근 7일 vs 직전 28일 수준
  let salesNorm: number | null = null;
  const ys = input.yearSales;
  if (Object.values(ys).filter((v) => v > 0).length >= 14) {
    const idx = weekdayIndex(ys, addYmd(y, -364), y);
    const usable = (d: string) => ys[d] != null && ys[d] > 0 && !HOLIDAYS.has(d);
    const ref: number[] = [];
    for (let d = addYmd(y, -34); d <= addYmd(y, -7); d = addYmd(d, 1)) if (usable(d)) ref.push(ys[d] / idx[wdOf(d)]);
    const level = ref.length ? ref.reduce((a, b) => a + b, 0) / ref.length : 0;
    let act = 0;
    let exp = 0;
    for (let d = addYmd(y, -6); d <= y; d = addYmd(d, 1)) if (usable(d)) {
      act += ys[d];
      exp += level * idx[wdOf(d)];
    }
    salesNorm = exp ? act / exp : null;
  }
  // 보정 평소 대비: 큰비·공휴일·특이일을 빼고 같은 계산
  let adjNorm: number | null = null;
  let rainEffect: number | null = null;
  if (Object.values(ys).filter((v) => v > 0).length >= 14) {
    const idx = weekdayIndex(ys, addYmd(y, -364), y);
    const ok = (d: string) => ys[d] != null && ys[d] > 0 && !excluded(d);
    const ref: number[] = [];
    for (let d = addYmd(y, -34); d <= addYmd(y, -7); d = addYmd(d, 1)) if (ok(d)) ref.push(ys[d] / idx[wdOf(d)]);
    const level = ref.length ? ref.reduce((a, b) => a + b, 0) / ref.length : 0;
    let act = 0;
    let exp = 0;
    for (let d = addYmd(y, -6); d <= y; d = addYmd(d, 1)) if (ok(d)) {
      act += ys[d];
      exp += level * idx[wdOf(d)];
    }
    adjNorm = exp ? act / exp : null;
    if (hasWeather) {
      const rainy: number[] = [];
      const dry: number[] = [];
      for (let d = addYmd(y, -364); d <= y; d = addYmd(d, 1)) {
        if (!(ys[d] > 0) || HOLIDAYS.has(d) || specials[d] != null || weather[d] == null) continue;
        ((weather[d] ?? 0) >= RAIN_MM ? rainy : dry).push(ys[d] / idx[wdOf(d)]);
      }
      if (rainy.length >= 5 && dry.length >= 10) {
        const m = (a: number[]) => a.reduce((p, q) => p + q, 0) / a.length;
        rainEffect = m(rainy) / m(dry) - 1;
      }
    }
  }
  const rainyDays7 = week.filter((r) => (r.rain ?? 0) >= RAIN_MM).length;
  const excluded7 = week.filter((r) => excluded(r.date)).length;
  // 손익분기
  const minRoas = 100 / (1 - costRate);
  const neededPer10k = Math.round(10000 / (1 - costRate));

  const todayRow = byDate.get(today);
  const todayCost = todayRow?.cost ?? 0;
  const todaySales = input.todayLive.sales;
  const convTracked = M.conv > 0 || MP.conv > 0;

  // 진단
  const F: AdInsight["findings"] = [];
  const dCost = pctDelta(W.cost, WP.cost);
  const dSales = pctDelta(W.sales, WP.sales);
  if (W.roas != null && WP.roas != null && W.roas < WP.roas * 0.8) F.push({ sev: "warn", text: `최근 7일 광고비 대비 매출(ROAS)이 ${won(WP.roas)}% → ${won(W.roas)}%로 떨어졌어요.` });
  else if (W.roas != null && WP.roas != null && W.roas > WP.roas * 1.2) F.push({ sev: "good", text: `최근 7일 ROAS가 ${won(WP.roas)}% → ${won(W.roas)}%로 좋아졌어요.` });
  if (dCost != null && dCost > 30 && (dSales == null || dSales < dCost / 2)) F.push({ sev: "warn", text: `광고비는 ${dTxt(dCost)} 늘었는데 매출은 ${dTxt(dSales)}예요. 늘린 예산이 매출로 안 이어지고 있어요.` });
  if (salesNorm != null && salesNorm < 0.85) F.push({ sev: "warn", text: `최근 7일 매출이 평소(요일·공휴일 보정)보다 ${((1 - salesNorm) * 100).toFixed(0)}% 낮아요.` });
  if (salesNorm != null && salesNorm > 1.1) F.push({ sev: "good", text: `최근 7일 매출이 평소보다 ${((salesNorm - 1) * 100).toFixed(0)}% 높아요.` });
  const withRoas = weekday.filter((w) => w.roas != null && w.days >= 2);
  if (withRoas.length >= 3) {
    const best = withRoas.reduce((a, b) => (b.roas! > a.roas! ? b : a));
    const worst = withRoas.reduce((a, b) => (b.roas! < a.roas! ? b : a));
    if (best.roas! > worst.roas! * 2) F.push({ sev: "info", text: `요일별로 보면 ${best.label}요일 ROAS ${won(best.roas)}%, ${worst.label}요일 ${won(worst.roas)}%예요. ${worst.label}요일 입찰가를 낮추고 ${best.label}요일에 예산을 더 두는 걸 검토하세요.` });
  }
  if (W.adShare != null && W.adShare > 5) F.push({ sev: "warn", text: `매출의 ${W.adShare.toFixed(1)}%를 광고비로 쓰고 있어요(최근 7일). 외식업 평균(1~3%)보다 높아요.` });
  if (W.cost > 0 && W.sales === 0 && W.salesDays === 0) F.push({ sev: "info", text: "토스 매출이 아직 안 쌓여서 ROAS를 계산할 수 없어요. 동기화를 눌러 주세요." });
  if (input.adConnected && W.cost === 0) F.push({ sev: "warn", text: "최근 7일 광고비가 0원이에요. 광고가 꺼져 있거나 비즈머니가 바닥났을 수 있어요." });
  if (rainyDays7 >= 2 && rainEffect != null && rainEffect < -0.03) {
    F.push({ sev: "info", text: `최근 7일 중 비 온 날이 ${rainyDays7}일이에요. 비 오는 날 매출은 평소보다 ${(-rainEffect * 100).toFixed(0)}% 낮은 편이라${adjNorm != null ? `, 큰비·공휴일·특이일을 빼면 평소 대비 ${((adjNorm - 1) * 100).toFixed(0)}%예요` : " 이번 주 매출 하락은 날씨 영향일 수 있어요"}.` });
  }
  if (excluded7 > 0 && adjNorm != null && salesNorm != null && Math.abs(adjNorm - salesNorm) >= 0.05) {
    F.push({ sev: "info", text: `큰비·공휴일·특이일 ${excluded7}일을 빼고 보면 평소 대비 ${((adjNorm - 1) * 100).toFixed(0)}%예요 (안 빼면 ${((salesNorm - 1) * 100).toFixed(0)}%).` });
  }
  if (W.roas != null && W.cost > 0) {
    if (W.roas < minRoas) F.push({ sev: "warn", text: `광고비 대비 매출 ${won(W.roas)}%가 손익분기 ${won(minRoas)}%(원가율 ${(costRate * 100).toFixed(0)}%) 아래예요. 광고로 번 이익보다 광고비가 커요.` });
    else if (W.roas < minRoas * 1.5) F.push({ sev: "info", text: `광고비 대비 매출 ${won(W.roas)}%는 손익분기 ${won(minRoas)}%를 넘지만 여유가 크진 않아요. 광고비를 늘리면 매출이 ${won(neededPer10k)}원/만원 이상 따라와야 해요.` });
  }
  if (F.length === 0) F.push({ sev: "good", text: "지난주와 큰 변화 없이 안정적이에요." });

  return {
    storeId: input.storeId,
    storeName: input.storeName,
    today: {
      date: today,
      sales: todaySales,
      orders: input.todayLive.orders,
      cost: todayCost,
      clk: todayRow?.clk ?? 0,
      conv: todayRow?.conv ?? 0,
      roas: todaySales && todayCost ? (todaySales / todayCost) * 100 : null,
      lastPayAt: input.todayLive.lastPayAt,
    },
    week: W,
    weekPrev: WP,
    month: M,
    monthPrev: MP,
    salesNorm,
    weekday,
    series: range(addYmd(today, -27), today),
    findings: F,
    convTracked,
    adConnected: input.adConnected,
    weather: { rainyDays7, excluded7, rainEffect, adjNorm, hasWeather },
    specialDays: Object.entries(specials)
      .filter(([d]) => d >= addYmd(today, -60))
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, note]) => ({ date, note })),
    breakeven: { costRate, minRoas, neededPer10k, weekProfit: W.salesDays > 0 ? Math.round(W.sales * (1 - costRate) - W.cost) : null },
  };
}

/* ---------- AI 전략 메모 입력 ---------- */
export function insightToPrompt(x: AdInsight): string {
  const p = (s: PeriodStat) => `매출 ${won(s.sales)}원(${s.salesDays}일) · 광고비 ${won(s.cost)}원 · 클릭 ${s.clk} · 전환 ${s.conv} · ROAS ${s.roas == null ? "-" : won(s.roas) + "%"} · 광고비 비중 ${s.adShare == null ? "-" : s.adShare.toFixed(1) + "%"} · 클릭당 ${won(s.cpc)}원`;
  const wd = x.weekday.map((w) => `${w.label}: 매출 ${won(w.sales)} / 광고비 ${won(w.cost)} / ROAS ${w.roas == null ? "-" : won(w.roas) + "%"} (${w.days}일)`).join("\n");
  const last14 = x.series.slice(-14).map((r) => `${r.date.slice(5)} 매출 ${r.sales == null ? "-" : won(r.sales)} / 광고비 ${won(r.cost)} / 클릭 ${r.clk}${(r.rain ?? 0) >= 1 ? ` / 비 ${r.rain}mm` : ""}${r.holiday ? " / 공휴일" : ""}${r.special ? ` / ${r.special}` : ""}`).join("\n");
  const adNote = x.adConnected ? "" : "\n※ 네이버 광고 계정이 아직 연결되지 않아 광고비·클릭·전환은 데이터가 없는 것(0으로 표시)이지, 광고를 안 한 게 아님. 광고 관련 판단은 보류하고 매출 흐름 중심으로 써라.";
  return `매장: ${x.storeName}${adNote}
오늘(${x.today.date}, 진행 중): 매출 ${won(x.today.sales)}원 · 광고비 ${won(x.today.cost)}원 · 클릭 ${x.today.clk}
최근 7일: ${p(x.week)}
직전 7일: ${p(x.weekPrev)}
최근 28일: ${p(x.month)}
직전 28일: ${p(x.monthPrev)}
최근 7일 매출의 평소 대비(요일·공휴일 보정): ${x.salesNorm == null ? "-" : ((x.salesNorm - 1) * 100).toFixed(1) + "%"}
전환 추적: ${x.convTracked ? "있음" : "없음(클릭 기준으로 판단)"}
손익분기: 원가율 ${(x.breakeven.costRate * 100).toFixed(0)}% → 광고비 대비 매출 ${won(x.breakeven.minRoas)}% 아래면 손해. 광고비 1만원 늘리면 매출 ${won(x.breakeven.neededPer10k)}원 이상 필요
날씨 보정: 최근 7일 중 비 온 날 ${x.weather.rainyDays7}일, 비교에서 뺀 날(큰비·공휴일·특이일) ${x.weather.excluded7}일${x.weather.rainEffect != null ? `, 비 오는 날 매출은 평소 대비 ${(x.weather.rainEffect * 100).toFixed(0)}%` : ""}${x.weather.adjNorm != null ? `, 보정 후 평소 대비 ${((x.weather.adjNorm - 1) * 100).toFixed(1)}%` : ""}
${x.specialDays.length ? `특이일: ${x.specialDays.map((s) => `${s.date} ${s.note}`).join(", ")}` : ""}
요일별(최근 28일):
${wd}

최근 14일 일별:
${last14}

자동 진단:
${x.findings.map((f) => `- ${f.text}`).join("\n")}`;
}
