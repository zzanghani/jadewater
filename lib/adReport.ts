// 네이버 검색광고 주간 리포트 — 계산 규칙 (인수인계 문서 4장 그대로).
// "지난주 숫자 → 평소 대비 판단 → 이번 주 할 일"을 매장마다 만든다.
// 매출은 우리 앱 마감입력(daily_closings.grand_total)을 쓴다. 광고 변경 이력·검색 노출·날씨는 1차에서 뺐다.
import { callNaver, pool, statsMap, STAT_FIELDS, type NaverAcct, type NaverStatRow } from "@/lib/naverAds";

/* ---------- 날짜 (KST) ---------- */
export function kstYmd(offsetDays = 0, now = Date.now()): string {
  return new Date(now + 9 * 3600e3 + offsetDays * 864e5).toISOString().slice(0, 10);
}
export function addYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const wdOf = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
function* dates(a: string, z: string) {
  for (let d = a; d <= z; d = addYmd(d, 1)) yield d;
}

export type Windows = {
  today: string;
  yesterday: string;
  week: [string, string];
  prev: [string, string];
  mtd: [string, string];
  monthDays: number;
  monthElapsed: number;
};
// 지난주 = 지난 월요일~일요일. mtd = 이번 달 1일 ~ 어제.
export function weekWindows(now = Date.now()): Windows {
  const t = kstYmd(0, now);
  const y = kstYmd(-1, now);
  const mon = addYmd(t, -((wdOf(t) + 6) % 7));
  const [yy, mm] = y.split("-").map(Number);
  return {
    today: t,
    yesterday: y,
    week: [addYmd(mon, -7), addYmd(mon, -1)],
    prev: [addYmd(mon, -14), addYmd(mon, -8)],
    mtd: [y.slice(0, 8) + "01", y],
    monthDays: new Date(Date.UTC(yy, mm, 0)).getUTCDate(),
    monthElapsed: Number(y.slice(8)),
  };
}

/* ---------- 지표 ---------- */
export type Metrics = { imp: number; clk: number; cost: number; conv: number; ctr: number | null; cpc: number | null; cpa: number | null };
const zero = () => ({ imp: 0, clk: 0, cost: 0, conv: 0 });
function add(a: { imp: number; clk: number; cost: number; conv: number }, s?: NaverStatRow) {
  a.imp += s?.impCnt ?? 0;
  a.clk += s?.clkCnt ?? 0;
  a.cost += s?.salesAmt ?? 0;
  a.conv += s?.ccnt ?? 0;
  return a;
}
export function derive(m: { imp: number; clk: number; cost: number; conv: number }): Metrics {
  return { ...m, ctr: m.imp ? (m.clk / m.imp) * 100 : null, cpc: m.clk ? m.cost / m.clk : null, cpa: m.conv ? m.cost / m.conv : null };
}
export const pctDelta = (c: number | null | undefined, p: number | null | undefined) =>
  c == null || p == null || p === 0 ? null : ((c - p) / p) * 100;
export const won = (n: number | null | undefined) => (n == null || !isFinite(n) ? "-" : Math.round(n).toLocaleString("ko-KR"));
export const dTxt = (d: number | null) => (d == null ? "-" : (d > 0 ? "+" : "") + d.toFixed(0) + "%");

/* ---------- 매출 평소 대비 (요일·공휴일 보정) ---------- */
export const HOLIDAYS = new Set([
  "2025-01-01","2025-01-27","2025-01-28","2025-01-29","2025-01-30","2025-03-01","2025-03-03","2025-05-05","2025-05-06","2025-06-03","2025-06-06","2025-08-15","2025-10-03","2025-10-05","2025-10-06","2025-10-07","2025-10-08","2025-10-09","2025-12-25",
  "2026-01-01","2026-02-16","2026-02-17","2026-02-18","2026-03-01","2026-03-02","2026-05-01","2026-05-05","2026-05-24","2026-05-25","2026-06-03","2026-06-06","2026-07-17","2026-08-15","2026-08-17","2026-09-24","2026-09-25","2026-09-26","2026-10-03","2026-10-05","2026-10-09","2026-12-25",
  "2027-01-01","2027-02-06","2027-02-07","2027-02-08","2027-02-09","2027-03-01","2027-05-01","2027-05-03","2027-05-05","2027-05-13","2027-06-06","2027-07-17","2027-07-19","2027-08-15","2027-08-16","2027-09-14","2027-09-15","2027-09-16","2027-10-03","2027-10-04","2027-10-09","2027-10-11","2027-12-25","2027-12-27",
]);
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export type SalesMap = Record<string, number>; // 'YYYY-MM-DD' → 매출
const usable = (sales: SalesMap, d: string) => sales[d] != null && sales[d] > 0 && !HOLIDAYS.has(d);

// 지난 1년 매출로 요일 지수(일주일 평균 1)를 만든다.
export function weekdayIndex(sales: SalesMap, a: string, z: string): number[] {
  const by: number[][] = [[], [], [], [], [], [], []];
  for (const d of dates(a, z)) if (usable(sales, d)) by[wdOf(d)].push(sales[d]);
  const m = mean(by.flat());
  if (!m) return [1, 1, 1, 1, 1, 1, 1];
  const filled = by.map((x) => (x.length >= 3 ? (mean(x) as number) / m : 1));
  const k = mean(filled) as number;
  return filled.map((x) => x / k);
}
// 기간 매출이 "직전 28일 요일 보정 평균" 대비 몇 배인지. 매출 14일 미만이면 null.
export function salesNorm(sales: SalesMap, week: [string, string], yesterday: string): number | null {
  if (Object.values(sales).filter((v) => v > 0).length < 14) return null;
  const idx = weekdayIndex(sales, addYmd(yesterday, -364), yesterday);
  const refNorm: number[] = [];
  for (const d of dates(addYmd(week[0], -28), addYmd(week[0], -1))) if (usable(sales, d)) refNorm.push(sales[d] / idx[wdOf(d)]);
  const level = mean(refNorm);
  if (!level) return null;
  let act = 0;
  let exp = 0;
  for (const d of dates(week[0], week[1])) if (usable(sales, d)) {
    act += sales[d];
    exp += level * idx[wdOf(d)];
  }
  return exp ? act / exp : null;
}
function sumRange(sales: SalesMap, [a, z]: [string, string]) {
  let sum = 0;
  let days = 0;
  for (const d of dates(a, z)) if (sales[d] != null) {
    sum += sales[d];
    days++;
  }
  return { sum, days };
}

/* ---------- 리포트 타입 ---------- */
export type AdAction = { sev: "bad" | "warn" | "good"; text: string };
export type AdStoreReport = {
  storeId: string;
  name: string;
  error?: string;
  week: Metrics;
  prev: Metrics;
  mtd: Metrics;
  biz: number | null;
  bizDays: number | null;
  projected: number | null;
  budget: number | null;
  targetCpa: number | null;
  convTracked: boolean;
  sales: {
    week: { sum: number; days: number };
    prev: { sum: number; days: number };
    mtd: { sum: number; days: number };
    norm: number | null;
    roas: number | null;
    roasPrev: number | null;
    adShare: number | null;
  } | null;
  zeroDays: string[];
  capped: string[];
  leaks: { keyword: string; path: string; cost: number; clk: number }[];
  stars: { keyword: string; conv: number; cpa: number | null; rank: number | null }[];
  actions: AdAction[];
};
export type AdWeeklyReport = {
  generatedAt: number;
  week: [string, string];
  prev: [string, string];
  mtd: [string, string];
  monthDays: number;
  monthElapsed: number;
  stores: AdStoreReport[];
};

type Campaign = { nccCampaignId: string; name: string; status?: string; userLock?: boolean; statusReason?: string };
type Adgroup = { nccAdgroupId: string; name: string; status?: string; userLock?: boolean };
type Keyword = { nccKeywordId: string; keyword: string; status?: string; userLock?: boolean };

/* ---------- 매장 한 곳 ---------- */
export async function buildStoreReport(input: {
  storeId: string;
  name: string;
  acct: NaverAcct;
  budget: number | null;
  targetCpa: number | null;
  sales: SalesMap | null;
  W: Windows;
}): Promise<AdStoreReport> {
  const { acct, W } = input;
  const get = <T,>(path: string, query?: Record<string, string | number | undefined>) => callNaver<T>(acct, path, query);

  const [bizR, campsAll] = await Promise.all([
    get<{ bizmoney?: number }>("/billing/bizmoney").catch(() => null),
    get<Campaign[]>("/ncc/campaigns"),
  ]);
  const camps = (campsAll ?? []).filter((c) => c.status !== "DELETED");
  const groups = (
    await pool(camps, 4, (c) =>
      get<Adgroup[]>("/ncc/adgroups", { nccCampaignId: c.nccCampaignId }).then((g) =>
        (g ?? []).filter((x) => x.status !== "DELETED").map((x) => ({ ...x, camp: c }))
      )
    )
  ).flat();
  const kws = (
    await pool(groups, 4, (g) =>
      get<Keyword[]>("/ncc/keywords", { nccAdgroupId: g.nccAdgroupId }).then((k) =>
        (k ?? []).filter((x) => x.status !== "DELETED").map((x) => ({ ...x, group: g, camp: g.camp }))
      )
    )
  ).flat();

  const cIds = camps.map((c) => c.nccCampaignId);
  const kIds = kws.map((k) => k.nccKeywordId);
  const [cw, cp, cm, kwS] = await Promise.all([
    statsMap(acct, cIds, W.week[0], W.week[1]),
    statsMap(acct, cIds, W.prev[0], W.prev[1]),
    statsMap(acct, cIds, W.mtd[0], W.mtd[1]),
    statsMap(acct, kIds, W.week[0], W.week[1]),
  ]);

  // 지난주 일별 광고비 (0원인 날 찾기). 캠페인별 일별 조회가 전부 성공한 경우에만 판단한다.
  const daily: Record<string, number> = {};
  let dailyOk = 0;
  await pool(camps, 3, async (c) => {
    const d = await get<{ data?: NaverStatRow[] }>("/stats", {
      id: c.nccCampaignId,
      fields: STAT_FIELDS,
      timeRange: JSON.stringify({ since: W.week[0], until: W.week[1] }),
      timeIncrement: "1",
    }).catch(() => null);
    if (d) dailyOk++;
    for (const r of d?.data ?? []) {
      const k = String(r.dateStart ?? "").slice(0, 10);
      if (k) daily[k] = (daily[k] ?? 0) + (r.salesAmt ?? 0);
    }
  });

  const T = derive(camps.reduce((a, c) => add(a, cw[c.nccCampaignId]), zero()));
  const P = derive(camps.reduce((a, c) => add(a, cp[c.nccCampaignId]), zero()));
  const M = derive(camps.reduce((a, c) => add(a, cm[c.nccCampaignId]), zero()));
  const biz = bizR?.bizmoney ?? null;
  const perDay = T.cost / 7;
  const bizDays = biz != null && perDay > 0 ? biz / perDay : null;
  const projected = W.monthElapsed ? (M.cost / W.monthElapsed) * W.monthDays : null;
  const budget = input.budget || null;
  const targetCpa = input.targetCpa || null;

  let sales: AdStoreReport["sales"] = null;
  if (input.sales) {
    const sw = sumRange(input.sales, W.week);
    const sp = sumRange(input.sales, W.prev);
    const smt = sumRange(input.sales, W.mtd);
    if (sw.days || sp.days || smt.days) {
      sales = {
        week: sw,
        prev: sp,
        mtd: smt,
        norm: salesNorm(input.sales, W.week, W.yesterday),
        roas: sw.sum && T.cost ? (sw.sum / T.cost) * 100 : null,
        roasPrev: sp.sum && P.cost ? (sp.sum / P.cost) * 100 : null,
        adShare: sw.sum ? (T.cost / sw.sum) * 100 : null,
      };
    }
  }

  const convTracked = T.conv > 0 || P.conv > 0;
  const K = kws.map((k) => ({ k, m: derive(add(zero(), kwS[k.nccKeywordId])) }));
  const on = K.filter((x) => !x.k.userLock && !x.k.group.userLock && !x.k.camp.userLock);
  const leakMin = Math.max(5000, T.cpa ? T.cpa * 1.5 : (T.cpc ?? 0) * 15);
  const leaks = convTracked ? on.filter((x) => x.m.conv === 0 && x.m.cost >= leakMin).sort((a, b) => b.m.cost - a.m.cost).slice(0, 5) : [];
  const stars = convTracked && T.cpa ? on.filter((x) => x.m.conv >= 1 && (x.m.cpa ?? Infinity) <= T.cpa! * 0.7).sort((a, b) => b.m.conv - a.m.conv).slice(0, 5) : [];
  const zeroDays: string[] = [];
  if (T.cost > 0 && dailyOk === camps.length) for (const d of dates(W.week[0], W.week[1])) if (!(daily[d] > 0)) zeroDays.push(d);
  const capped = camps.filter((c) => !c.userLock && /BUDGET/.test(String(c.statusReason ?? ""))).map((c) => c.name);

  // 이번 주 할 일 — 위에서부터 검사, 심각도 순, 최대 5개
  const A: AdAction[] = [];
  if (biz != null && biz <= 0) A.push({ sev: "bad", text: `비즈머니가 바닥나(잔액 ${won(biz)}원) 광고가 멈춰 있습니다. 오늘 충전하세요.` });
  else if (bizDays != null && bizDays < 7) A.push({ sev: "bad", text: `비즈머니가 ${bizDays < 1 ? "하루 안에" : `약 ${Math.floor(bizDays)}일 뒤`} 바닥납니다(잔액 ${won(biz)}원). 이번 주 충전하세요.` });
  if (zeroDays.length) A.push({ sev: "bad", text: `지난주 광고비 0원인 날 ${zeroDays.length}일(${zeroDays.map((d) => d.slice(5)).join(", ")}). 비즈머니·캠페인 상태를 확인하세요.` });
  if (budget && projected != null && projected > budget * 1.1) A.push({ sev: "warn", text: `이 속도면 월말 광고비 ${won(projected)}원으로 월 예산 ${won(budget)}원을 ${((projected / budget - 1) * 100).toFixed(0)}% 넘습니다. 효율 낮은 키워드부터 입찰가를 낮추세요.` });
  if (targetCpa && T.cpa && T.cpa > targetCpa * 1.2) A.push({ sev: "warn", text: `전환당 비용 ${won(T.cpa)}원으로 목표 ${won(targetCpa)}원보다 ${((T.cpa / targetCpa - 1) * 100).toFixed(0)}% 높습니다.` });
  if (leaks.length) A.push({ sev: "warn", text: `전환 없이 광고비만 쓴 키워드 ${leaks.length}개(합계 ${won(leaks.reduce((a, x) => a + x.m.cost, 0))}원): ${leaks.slice(0, 3).map((x) => x.k.keyword).join(", ")}. 입찰가를 30% 낮추거나 끄세요.` });
  const dC = pctDelta(T.cost, P.cost);
  const dV = pctDelta(convTracked ? T.conv : T.clk, convTracked ? P.conv : P.clk);
  if (dC != null && dC > 30 && (dV == null || dV < dC / 2)) A.push({ sev: "warn", text: `광고비가 전주보다 ${dTxt(dC)} 늘었는데 ${convTracked ? "전환" : "클릭"}은 ${dTxt(dV)}입니다.` });
  if (sales?.norm != null && sales.norm < 0.85) A.push({ sev: "warn", text: `지난주 매출이 평소(요일·공휴일 보정)보다 ${((1 - sales.norm) * 100).toFixed(0)}% 낮았습니다. 광고 변화와 겹치는지 확인하세요.` });
  if (sales?.roas != null && sales.roasPrev != null && sales.roas < sales.roasPrev * 0.8) A.push({ sev: "warn", text: `광고비 대비 매출이 ${won(sales.roasPrev)}% → ${won(sales.roas)}%로 떨어졌습니다.` });
  if (capped.length) A.push({ sev: "warn", text: `하루 예산이 일찍 소진되는 캠페인: ${capped.join(", ")}.` });
  if (stars.length) A.push({ sev: "good", text: `효율 좋은 키워드: ${stars.slice(0, 3).map((x) => x.k.keyword).join(", ")}. 순위가 3위 밖이면 입찰가를 10~20% 올리세요.` });
  const order = { bad: 0, warn: 1, good: 2 };
  A.sort((a, b) => order[a.sev] - order[b.sev]);

  return {
    storeId: input.storeId,
    name: input.name,
    week: T,
    prev: P,
    mtd: M,
    biz,
    bizDays,
    projected,
    budget,
    targetCpa,
    convTracked,
    sales,
    zeroDays,
    capped,
    leaks: leaks.map((x) => ({ keyword: x.k.keyword, path: `${x.k.camp.name} › ${x.k.group.name}`, cost: x.m.cost, clk: x.m.clk })),
    stars: stars.map((x) => ({ keyword: x.k.keyword, conv: x.m.conv, cpa: x.m.cpa, rank: kwS[x.k.nccKeywordId]?.avgRnk ?? null })),
    actions: A.slice(0, 5),
  };
}

/* ---------- 텍스트 (카톡·푸시) ---------- */
export function storeReportText(s: AdStoreReport): string[] {
  const L = [`■ ${s.name}`];
  if (s.error) return [...L, `  불러오지 못했습니다: ${s.error}`];
  const w = s.week;
  const p = s.prev;
  L.push(
    `  광고비 ${won(w.cost)}원 (전주 ${dTxt(pctDelta(w.cost, p.cost))}) · 클릭 ${won(w.clk)} (${dTxt(pctDelta(w.clk, p.clk))})` +
      (s.convTracked ? ` · 전환 ${won(w.conv)} (${dTxt(pctDelta(w.conv, p.conv))}) · 전환당 ${won(w.cpa)}원` : "")
  );
  if (s.sales) {
    L.push(
      `  매출 ${won(s.sales.week.sum)}원(${s.sales.week.days}일 입력)` +
        (s.sales.norm != null ? ` · 평소 대비 ${(s.sales.norm >= 1 ? "+" : "") + ((s.sales.norm - 1) * 100).toFixed(1)}%` : "") +
        ` · 광고비 대비 매출 ${s.sales.roas == null ? "-" : won(s.sales.roas) + "%"}`
    );
  }
  L.push(
    `  이번 달 광고비 ${won(s.mtd.cost)}원 → 월말 예상 ${won(s.projected)}원${s.budget ? ` (월 예산 ${won(s.budget)}원)` : ""} · 비즈머니 ${won(s.biz)}원${s.bizDays != null ? `(약 ${Math.floor(s.bizDays)}일분)` : ""}`
  );
  if (s.actions.length) {
    L.push("  할 일");
    s.actions.slice(0, 3).forEach((a, i) => L.push(`  ${i + 1}. ${a.text}`));
  } else L.push("  급한 조치 없음");
  return L;
}
export function reportText(rep: AdWeeklyReport): string {
  const L = [`[네이버 검색광고 주간 리포트] ${rep.week[0]} ~ ${rep.week[1]}`];
  for (const s of rep.stores) L.push("", ...storeReportText(s));
  return L.join("\n");
}
