// 성과 확인 게시판 글 — "어제 광고 성과"를 숫자 몇 개와 진단 문장으로 정리한다.
// 크론이 매일 아침 만들어 ad_daily_posts 에 저장하고, 화면은 그 jsonb 를 그대로 그린다.
// 순수 계산만 있어서 서버·클라이언트 어디서든 불러 쓸 수 있다.
import { addYmd, HOLIDAYS } from "@/lib/adReport";

export type AdDay = { date: string; imp: number; clk: number; cost: number; conv: number; sales: number | null; orders: number | null };
export type AdAgg = { cost: number; clk: number; conv: number; sales: number | null; salesDays: number; days: number };
export type AdFlag = { sev: "good" | "warn" | "bad" | "info"; text: string };

export type AdDailyPost = {
  date: string; // 성과 날짜(어제)
  storeName: string;
  adConnected: boolean;
  salesSource: "toss" | "closing" | null;
  y: AdDay; // 어제
  lastWeek: AdDay | null; // 지난주 같은 요일
  w7: AdAgg; // 어제까지 7일
  p7: AdAgg; // 그 전 7일
  mtd: { cost: number; sales: number | null; budget: number | null; day: number; monthDays: number };
  flags: AdFlag[];
  comment: string | null; // AI 한 줄 평 (없으면 규칙 문장만)
};

export const man = (n: number | null | undefined) => (n == null ? "-" : n >= 10000 ? `${(n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: n >= 100000 ? 0 : 1 })}만원` : `${Math.round(n).toLocaleString("ko-KR")}원`);
export const roasPerMan = (sales: number | null, cost: number) => (sales == null || cost <= 0 ? null : sales / cost); // 광고비 1만원당 매출(만원)
export const pct = (c: number, p: number) => (p > 0 ? Math.round(((c - p) / p) * 100) : null);

function agg(days: AdDay[]): AdAgg {
  const withSales = days.filter((d) => d.sales != null);
  return {
    cost: days.reduce((a, d) => a + d.cost, 0),
    clk: days.reduce((a, d) => a + d.clk, 0),
    conv: days.reduce((a, d) => a + d.conv, 0),
    sales: withSales.length ? withSales.reduce((a, d) => a + (d.sales ?? 0), 0) : null,
    salesDays: withSales.length,
    days: days.length,
  };
}

export function buildAdDailyPost(input: {
  date: string; // 어제
  storeName: string;
  adConnected: boolean;
  salesSource: "toss" | "closing" | null;
  ad: Record<string, { imp: number; clk: number; cost: number; conv: number }>;
  sales: Record<string, { sales: number; orders: number | null }>;
  budget: number | null;
}): AdDailyPost {
  const { date } = input;
  const day = (d: string): AdDay => {
    const a = input.ad[d] ?? { imp: 0, clk: 0, cost: 0, conv: 0 };
    const s = input.sales[d];
    return { date: d, ...a, sales: s ? s.sales : null, orders: s ? s.orders : null };
  };
  const range = (a: string, z: string) => {
    const out: AdDay[] = [];
    for (let d = a; d <= z; d = addYmd(d, 1)) out.push(day(d));
    return out;
  };
  const y = day(date);
  const lw = day(addYmd(date, -7));
  const lastWeek = lw.cost > 0 || lw.sales != null ? lw : null;
  const w7 = agg(range(addYmd(date, -6), date));
  const p7 = agg(range(addYmd(date, -13), addYmd(date, -7)));
  const monthStart = date.slice(0, 7) + "-01";
  const nextMonth = addYmd(date.slice(0, 7) + "-28", 4).slice(0, 7) + "-01";
  const monthDays = Number(addYmd(nextMonth, -1).slice(8, 10));
  const m = agg(range(monthStart, date));
  const mtd = { cost: m.cost, sales: m.sales, budget: input.budget, day: Number(date.slice(8, 10)), monthDays };

  const flags: AdFlag[] = [];
  const yR = roasPerMan(y.sales, y.cost);
  const w7R = roasPerMan(w7.sales, w7.cost);
  const holiday = HOLIDAYS.has(date);
  if (input.adConnected) {
    if (y.cost === 0 && y.imp === 0) flags.push({ sev: "bad", text: "어제 광고가 전혀 나가지 않았어요. 캠페인이 꺼졌거나 비즈머니가 떨어졌는지 확인해 주세요." });
    else if (y.imp > 0 && y.clk === 0) flags.push({ sev: "bad", text: `노출은 ${y.imp.toLocaleString()}번인데 클릭이 0이에요. 광고 문구·키워드를 점검해 주세요.` });
    if (lastWeek && lastWeek.cost > 0 && y.cost > 0) {
      const d = pct(y.cost, lastWeek.cost)!;
      if (d >= 30) flags.push({ sev: "warn", text: `광고비가 지난주 같은 요일보다 ${d}% 늘었어요 (${man(lastWeek.cost)} → ${man(y.cost)}).` });
      else if (d <= -30) flags.push({ sev: "info", text: `광고비가 지난주 같은 요일보다 ${-d}% 줄었어요 (${man(lastWeek.cost)} → ${man(y.cost)}).` });
    }
    if (yR != null && w7R != null && w7R > 0) {
      if (yR < w7R * 0.7) flags.push({ sev: "warn", text: `어제는 광고비 1만원당 매출 ${yR.toFixed(1)}만원으로, 최근 7일 평균(${w7R.toFixed(1)}만원)보다 낮았어요.` });
      else if (yR > w7R * 1.3) flags.push({ sev: "good", text: `어제는 광고비 1만원당 매출 ${yR.toFixed(1)}만원으로, 최근 7일 평균(${w7R.toFixed(1)}만원)보다 좋았어요.` });
    }
    if (w7.clk >= 30 && w7.conv === 0) flags.push({ sev: "warn", text: "최근 7일 클릭은 있는데 예약·전화 집계가 0이에요. 전환 추적 설정을 확인해 주세요." });
    if (mtd.budget && mtd.budget > 0 && mtd.day >= 3) {
      const expected = (mtd.budget * mtd.day) / mtd.monthDays;
      const r = mtd.cost / expected;
      if (r >= 1.15) flags.push({ sev: "warn", text: `이달 광고비가 예산 페이스보다 ${Math.round((r - 1) * 100)}% 빨라요 (누적 ${man(mtd.cost)} / 월 예산 ${man(mtd.budget)}).` });
      else if (r <= 0.7) flags.push({ sev: "info", text: `이달 광고비가 예산 페이스의 ${Math.round(r * 100)}% 수준이에요 (누적 ${man(mtd.cost)} / 월 예산 ${man(mtd.budget)}).` });
    }
    if (w7.cost > 0 && p7.cost > 0 && w7.sales != null && p7.sales != null && w7.salesDays >= 5 && p7.salesDays >= 5) {
      const dc = pct(w7.cost, p7.cost)!;
      const ds = pct(w7.sales, p7.sales)!;
      if (dc >= 15 && ds <= 0) flags.push({ sev: "warn", text: `최근 7일 광고비는 ${dc}% 늘었는데 매출은 ${ds === 0 ? "그대로" : `${-ds}% 줄었어요`}. 광고비가 매출로 안 이어지고 있어요.` });
      else if (ds >= 10 && dc <= 5) flags.push({ sev: "good", text: `최근 7일 매출이 ${ds}% 늘었는데 광고비는 ${dc <= 0 ? "늘지 않았어요" : `${dc}%만 늘었어요`}.` });
    }
  } else {
    flags.push({ sev: "info", text: "이 매장은 네이버 광고가 아직 연결되지 않아 매출만 보여요." });
  }
  if (lastWeek && lastWeek.sales != null && y.sales != null && lastWeek.sales > 0) {
    const d = pct(y.sales, lastWeek.sales)!;
    if (d <= -20) flags.push({ sev: "warn", text: `매출이 지난주 같은 요일보다 ${-d}% 적었어요 (${man(lastWeek.sales)} → ${man(y.sales)}).${holiday ? " 공휴일이라 평소와 달랐을 수 있어요." : ""}` });
    else if (d >= 20) flags.push({ sev: "good", text: `매출이 지난주 같은 요일보다 ${d}% 많았어요 (${man(lastWeek.sales)} → ${man(y.sales)}).${holiday ? " 공휴일 효과가 있었을 수 있어요." : ""}` });
  }
  if (y.sales == null) flags.push({ sev: "info", text: input.salesSource === "closing" ? "어제 마감입력이 아직 없어 매출을 못 넣었어요." : "어제 매출 자료를 아직 못 받았어요." });
  if (!flags.length) flags.push({ sev: "good", text: "특별히 급한 점은 없어요. 평소대로 운영하면 됩니다." });

  return { date, storeName: input.storeName, adConnected: input.adConnected, salesSource: input.salesSource, y, lastWeek, w7, p7, mtd, flags, comment: null };
}

// AI 한 줄 평을 쓰게 할 때 넘기는 글. 숫자만 간단히.
export function adDailyPostToText(p: AdDailyPost): string {
  const L: string[] = [];
  L.push(`매장: ${p.storeName} / 날짜: ${p.date}${HOLIDAYS.has(p.date) ? " (공휴일)" : ""}`);
  L.push(`어제: 광고비 ${man(p.y.cost)}, 노출 ${p.y.imp}, 클릭 ${p.y.clk}, 예약·전화 집계 ${p.y.conv}, 매출 ${p.y.sales == null ? "자료 없음" : man(p.y.sales)}${p.y.orders != null ? `, 주문 ${p.y.orders}건` : ""}`);
  if (p.lastWeek) L.push(`지난주 같은 요일: 광고비 ${man(p.lastWeek.cost)}, 클릭 ${p.lastWeek.clk}, 매출 ${p.lastWeek.sales == null ? "자료 없음" : man(p.lastWeek.sales)}`);
  L.push(`최근 7일: 광고비 ${man(p.w7.cost)}, 클릭 ${p.w7.clk}, 매출 ${p.w7.sales == null ? "자료 없음" : man(p.w7.sales)} / 그 전 7일: 광고비 ${man(p.p7.cost)}, 클릭 ${p.p7.clk}, 매출 ${p.p7.sales == null ? "자료 없음" : man(p.p7.sales)}`);
  L.push(`이달 누적(${p.mtd.day}일/${p.mtd.monthDays}일): 광고비 ${man(p.mtd.cost)}${p.mtd.budget ? `, 월 예산 ${man(p.mtd.budget)}` : ""}, 매출 ${p.mtd.sales == null ? "자료 없음" : man(p.mtd.sales)}`);
  L.push(`자동 진단: ${p.flags.map((f) => f.text).join(" / ")}`);
  return L.join("\n");
}

// 푸시 알림 본문 한 줄.
export function adDailyPostPushBody(p: AdDailyPost): string {
  const r = roasPerMan(p.y.sales, p.y.cost);
  const head = p.adConnected ? `광고비 ${man(p.y.cost)} · 매출 ${p.y.sales == null ? "-" : man(p.y.sales)}${r != null ? ` · 1만원당 ${r.toFixed(1)}만원` : ""}` : `매출 ${p.y.sales == null ? "-" : man(p.y.sales)}`;
  const first = p.flags.find((f) => f.sev === "bad") ?? p.flags.find((f) => f.sev === "warn") ?? p.flags[0];
  return first ? `${head}\n${first.text}` : head;
}
