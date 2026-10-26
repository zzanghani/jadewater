// 광고 리포트 기간 선택: 오늘·어제·최근 7일·최근 30일·이번 달·지난달·직접 선택.
// 비교 기간은 "직전 같은 길이" (오늘·어제는 지난주 같은 요일, 이번 달은 지난달 같은 날짜까지).
import { addYmd } from "@/lib/adReport";

export type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "month" | "lastMonth" | "custom";
export const PERIOD_LABEL: Record<PeriodKey, string> = {
  today: "오늘",
  yesterday: "어제",
  "7d": "최근 7일",
  "30d": "최근 30일",
  month: "이번 달",
  lastMonth: "지난달",
  custom: "직접 선택",
};

export type PeriodRange = { from: string; to: string; cmpFrom: string; cmpTo: string; cmpLabel: string };

const daysBetween = (a: string, z: string) => Math.round((Date.parse(z) - Date.parse(a)) / 86400e3) + 1;

export function periodRange(key: PeriodKey, today: string, custom?: { from: string; to: string }): PeriodRange {
  const y = addYmd(today, -1);
  switch (key) {
    case "today":
      return { from: today, to: today, cmpFrom: addYmd(today, -7), cmpTo: addYmd(today, -7), cmpLabel: "지난주 같은 요일(하루 전체)" };
    case "yesterday":
      return { from: y, to: y, cmpFrom: addYmd(y, -7), cmpTo: addYmd(y, -7), cmpLabel: "지난주 같은 요일" };
    case "7d":
      return { from: addYmd(y, -6), to: y, cmpFrom: addYmd(y, -13), cmpTo: addYmd(y, -7), cmpLabel: "직전 7일" };
    case "30d":
      return { from: addYmd(y, -29), to: y, cmpFrom: addYmd(y, -59), cmpTo: addYmd(y, -30), cmpLabel: "직전 30일" };
    case "month": {
      const from = today.slice(0, 8) + "01";
      const lmEnd = addYmd(from, -1);
      const lmStart = lmEnd.slice(0, 8) + "01";
      const sameDay = Math.min(Number(today.slice(8)), Number(lmEnd.slice(8)));
      const cmpTo = lmStart.slice(0, 8) + String(sameDay).padStart(2, "0");
      return { from, to: today, cmpFrom: lmStart, cmpTo, cmpLabel: "지난달 같은 날짜까지" };
    }
    case "lastMonth": {
      const thisStart = today.slice(0, 8) + "01";
      const to = addYmd(thisStart, -1);
      const from = to.slice(0, 8) + "01";
      const cmpTo = addYmd(from, -1);
      const cmpFrom = cmpTo.slice(0, 8) + "01";
      return { from, to, cmpFrom, cmpTo, cmpLabel: "전전달" };
    }
    case "custom": {
      let from = custom?.from ?? addYmd(y, -6);
      let to = custom?.to ?? y;
      if (from > to) [from, to] = [to, from];
      if (to > today) to = today;
      const n = daysBetween(from, to);
      return { from, to, cmpFrom: addYmd(from, -n), cmpTo: addYmd(from, -1), cmpLabel: `직전 ${n}일` };
    }
  }
}

export type PeriodAgg = {
  days: number;
  cost: number;
  imp: number;
  clk: number;
  conv: number;
  sales: number | null; // 매출 자료가 하나도 없으면 null
  salesDays: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  adShare: number | null;
};

export function aggregate(rows: { cost: number; imp: number; clk: number; conv: number; sales: number | null }[]): PeriodAgg {
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const imp = rows.reduce((s, r) => s + r.imp, 0);
  const clk = rows.reduce((s, r) => s + r.clk, 0);
  const conv = rows.reduce((s, r) => s + r.conv, 0);
  const withSales = rows.filter((r) => r.sales != null);
  const sales = withSales.length ? withSales.reduce((s, r) => s + (r.sales ?? 0), 0) : null;
  const costOnSalesDays = withSales.reduce((s, r) => s + r.cost, 0);
  return {
    days: rows.length,
    cost,
    imp,
    clk,
    conv,
    sales,
    salesDays: withSales.length,
    ctr: imp ? (clk / imp) * 100 : null,
    cpc: clk ? cost / clk : null,
    cpa: conv ? cost / conv : null,
    roas: sales && costOnSalesDays ? (sales / costOnSalesDays) * 100 : null,
    adShare: sales ? (costOnSalesDays / sales) * 100 : null,
  };
}

export const MAX_RANGE_DAYS = 93;
