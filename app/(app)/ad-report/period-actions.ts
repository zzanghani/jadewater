"use server";

// 광고 리포트 기간별 조회. 쌓인 날짜(ad_daily_stats·toss_daily_sales)를 먼저 쓰고,
// 비어 있는 날은 그 자리에서 네이버·토스에서 받아 채운다. 오늘은 항상 실시간으로 다시 읽는다.
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { adReportAllowedFor } from "@/lib/adAccess";
import { addYmd, kstYmd } from "@/lib/adReport";
import { aggregate, MAX_RANGE_DAYS, periodRange, type PeriodAgg, type PeriodKey, type PeriodRange } from "@/lib/adPeriod";
import { syncAdDaily, syncTossDaily } from "@/lib/adInsight";
import { fetchTossClosing } from "@/lib/tossClosing";

export type PeriodStore = {
  storeId: string;
  name: string;
  adConnected: boolean;
  tossLinked: boolean;
  cur: PeriodAgg;
  cmp: PeriodAgg;
  error?: string;
};
export type PeriodResult =
  | { ok: true; range: PeriodRange; today: string; stores: PeriodStore[]; total: { cur: PeriodAgg; cmp: PeriodAgg } | null }
  | { ok: false; error: string };

type Row = { date: string; cost: number; imp: number; clk: number; conv: number; sales: number | null };

export async function loadAdPeriod(key: PeriodKey, custom?: { from: string; to: string }): Promise<PeriodResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data: profile } = await supabase.from("profiles").select("role, store_id, department, status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "approved" || profile.department || profile.role !== "owner") return { ok: false, error: "지점장·대표 계정만 볼 수 있어요." };
  if (!(await adReportAllowedFor(supabase, profile))) return { ok: false, error: "광고 리포트는 아직 시범 운영 중이라 이 계정에서는 볼 수 없어요." };

  const today = kstYmd(0);
  const range = periodRange(key, today, custom);
  const spanDays = Math.round((Date.parse(range.to) - Date.parse(range.cmpFrom)) / 86400e3) + 1;
  if (spanDays > MAX_RANGE_DAYS * 2) return { ok: false, error: `한 번에 ${MAX_RANGE_DAYS}일까지만 볼 수 있어요.` };

  const service = createServiceClient();
  let sq = supabase.from("stores").select("id, name");
  if (profile.store_id) sq = sq.eq("id", profile.store_id);
  const [{ data: storeRows }, { data: accounts }, { data: merchants }, { data: toss }] = await Promise.all([
    sq.order("name"),
    service.from("store_ad_accounts").select("*").eq("enabled", true),
    service.from("store_toss_merchants").select("store_id, merchant_id"),
    service.from("toss_settings").select("access_key, access_secret").eq("id", 1).maybeSingle(),
  ]);
  const acctByStore = new Map((accounts ?? []).map((a) => [a.store_id, a]));
  const merchantByStore = new Map((merchants ?? []).map((m) => [m.store_id, m.merchant_id]));
  const keys = toss ? { accessKey: toss.access_key, secretKey: toss.access_secret } : null;
  const targets = (storeRows ?? []).filter((s) => acctByStore.has(s.id) || merchantByStore.has(s.id));
  if (!targets.length) return { ok: false, error: profile.store_id ? "이 매장은 아직 광고·토스가 연결되지 않았어요." : "연결된 매장이 없어요. 매장 키 설정에서 등록해 주세요." };

  const from = range.cmpFrom;
  const to = range.to;
  const stores: PeriodStore[] = [];
  for (const s of targets) {
    const a = acctByStore.get(s.id);
    const acct = a ? { customerId: a.naver_customer_id, apiKey: a.naver_api_key, secretKey: a.naver_secret_key } : null;
    const merchant = merchantByStore.get(s.id) ?? null;
    let error: string | undefined;
    try {
      // 1) 광고: 비어 있는 날 + 오늘을 네이버에서 받아 채운다 (31일씩).
      if (acct) {
        const { data: have } = await service.from("ad_daily_stats").select("date").eq("store_id", s.id).gte("date", from).lte("date", to);
        const haveSet = new Set((have ?? []).map((r) => r.date));
        const missing: string[] = [];
        for (let d = from; d <= to; d = addYmd(d, 1)) if (!haveSet.has(d) || d === today) missing.push(d);
        for (const [a0, z0] of chunks(missing)) await syncAdDaily(service, s.id, acct, a0, z0);
      }
      // 2) 토스: 비어 있는 날을 채운다 (오늘은 실시간으로 따로).
      if (keys && merchant && from < today) await syncTossDaily(service, s.id, keys, merchant, from, to < today ? to : addYmd(today, -1));
    } catch (e) {
      error = (e as Error).message;
    }

    const [{ data: adRows }, { data: tossRows }, { data: closings }] = await Promise.all([
      service.from("ad_daily_stats").select("date, imp, clk, cost, conv").eq("store_id", s.id).gte("date", from).lte("date", to),
      service.from("toss_daily_sales").select("date, sales").eq("store_id", s.id).gte("date", from).lte("date", to),
      service.from("daily_closings").select("date, grand_total").eq("store_id", s.id).gte("date", from).lte("date", to),
    ]);
    const ad = new Map((adRows ?? []).map((r) => [r.date, r]));
    const tossMap = new Map((tossRows ?? []).map((r) => [r.date, r.sales]));
    const closeMap = new Map((closings ?? []).map((r) => [r.date, r.grand_total]));
    let todaySales: number | null = null;
    if (keys && merchant && to === today) {
      try {
        todaySales = (await fetchTossClosing(keys, merchant, today)).paid;
      } catch {
        todaySales = null;
      }
    }
    const row = (d: string): Row => {
      const x = ad.get(d);
      let sales: number | null;
      if (d === today && merchant) sales = todaySales;
      else if (merchant) sales = tossMap.get(d) ?? null;
      else sales = closeMap.get(d) ?? null;
      return { date: d, cost: x?.cost ?? 0, imp: x?.imp ?? 0, clk: x?.clk ?? 0, conv: x?.conv ?? 0, sales };
    };
    const span = (a0: string, z0: string) => {
      const out: Row[] = [];
      for (let d = a0; d <= z0; d = addYmd(d, 1)) out.push(row(d));
      return out;
    };
    stores.push({ storeId: s.id, name: s.name, adConnected: !!acct, tossLinked: !!merchant, cur: aggregate(span(range.from, range.to)), cmp: aggregate(span(range.cmpFrom, range.cmpTo)), error });
  }

  const total =
    stores.length > 1
      ? {
          cur: sumAgg(stores.map((s) => s.cur)),
          cmp: sumAgg(stores.map((s) => s.cmp)),
        }
      : null;
  return { ok: true, range, today, stores, total };
}

// 연속된 날짜를 31일 이하 덩어리로 (네이버 stats 제한)
function chunks(days: string[]): [string, string][] {
  const out: [string, string][] = [];
  let start: string | null = null;
  let prev: string | null = null;
  let n = 0;
  for (const d of days) {
    if (start && prev && d === addYmd(prev, 1) && n < 31) {
      prev = d;
      n++;
      continue;
    }
    if (start && prev) out.push([start, prev]);
    start = d;
    prev = d;
    n = 1;
  }
  if (start && prev) out.push([start, prev]);
  return out;
}

function sumAgg(list: PeriodAgg[]): PeriodAgg {
  const cost = list.reduce((s, a) => s + a.cost, 0);
  const imp = list.reduce((s, a) => s + a.imp, 0);
  const clk = list.reduce((s, a) => s + a.clk, 0);
  const conv = list.reduce((s, a) => s + a.conv, 0);
  const withSales = list.filter((a) => a.sales != null);
  const sales = withSales.length ? withSales.reduce((s, a) => s + (a.sales ?? 0), 0) : null;
  const costOnSales = withSales.reduce((s, a) => s + a.cost, 0);
  return {
    days: list[0]?.days ?? 0,
    cost,
    imp,
    clk,
    conv,
    sales,
    salesDays: withSales.reduce((s, a) => s + a.salesDays, 0),
    ctr: imp ? (clk / imp) * 100 : null,
    cpc: clk ? cost / clk : null,
    cpa: conv ? cost / conv : null,
    roas: sales && costOnSales ? (sales / costOnSales) * 100 : null,
    adShare: sales ? (costOnSales / sales) * 100 : null,
  };
}
