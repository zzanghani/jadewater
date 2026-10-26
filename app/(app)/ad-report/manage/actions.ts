"use server";

// 광고 관리(3순위): 앱에서 캠페인을 켜고 끄고 하루 예산을 바꾼다. 바꾼 건 모두 기록하고,
// 7일이 지나면 전후 7일을 비교해 효과를 판정한다 (변동 ±34% 안이면 '판단 보류').
export const maxDuration = 60;

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { addYmd, kstYmd } from "@/lib/adReport";
import { callNaver, CAMPAIGN_TP_LABEL, listCampaigns, setCampaignBudget, setCampaignLock, statsMap, type NaverAcct, type NaverCampaign } from "@/lib/naverAds";
import type { AdChangeLog } from "@/lib/types";

export type CampaignRow = {
  id: string;
  name: string;
  type: string;
  on: boolean; // userLock의 반대
  status: string;
  dailyBudget: number; // 0 = 제한 없음
  week: { imp: number; clk: number; cost: number; conv: number };
};

export type ChangeEffect = {
  state: "pending" | "hold" | "better" | "worse";
  daysAfter: number;
  before: { sales: number; cost: number; roas: number | null };
  after: { sales: number; cost: number; roas: number | null };
  text: string;
};
export type ChangeRow = AdChangeLog & { effect: ChangeEffect | null; label: string };

export type ManageResult =
  | { ok: true; campaigns: CampaignRow[]; changes: ChangeRow[]; bizmoney: number | null }
  | { ok: false; error: string };

type Ctx = { error: string } | { error?: undefined; userId: string; userName: string; acct: NaverAcct };

async function ctx(storeId: string): Promise<Ctx> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { data: p } = await supabase.from("profiles").select("name, role, store_id, department, status").eq("id", user.id).maybeSingle();
  if (!p || p.status !== "approved" || p.department || p.role !== "owner" || (p.store_id && p.store_id !== storeId)) {
    return { error: "이 매장의 광고를 관리할 권한이 없어요." };
  }
  const { data: a } = await createServiceClient().from("store_ad_accounts").select("*").eq("store_id", storeId).eq("enabled", true).maybeSingle();
  if (!a) return { error: "이 매장은 네이버 광고 계정이 아직 연결되지 않았어요. 광고 리포트 → 매장 키 설정에서 등록해 주세요." };
  return { userId: user.id, userName: p.name ?? "", acct: { customerId: a.naver_customer_id, apiKey: a.naver_api_key, secretKey: a.naver_secret_key } };
}

const toRow = (c: NaverCampaign, w: CampaignRow["week"]): CampaignRow => ({
  id: c.nccCampaignId,
  name: c.name,
  type: CAMPAIGN_TP_LABEL[c.campaignTp ?? ""] ?? c.campaignTp ?? "",
  on: !c.userLock,
  status: c.status ?? "",
  dailyBudget: c.useDailyBudget ? c.dailyBudget ?? 0 : 0,
  week: w,
});

export async function loadCampaigns(storeId: string): Promise<ManageResult> {
  const c = await ctx(storeId);
  if (c.error !== undefined) return { ok: false, error: c.error };
  const today = kstYmd(0);
  try {
    const camps = await listCampaigns(c.acct);
    const [stats, biz] = await Promise.all([
      statsMap(c.acct, camps.map((x) => x.nccCampaignId), addYmd(today, -7), addYmd(today, -1)).catch(() => ({}) as Awaited<ReturnType<typeof statsMap>>),
      fetchBizmoney(c.acct),
    ]);
    const rows = camps.map((x) => {
      const s = stats[x.nccCampaignId];
      return toRow(x, { imp: s?.impCnt ?? 0, clk: s?.clkCnt ?? 0, cost: Math.round(s?.salesAmt ?? 0), conv: s?.ccnt ?? 0 });
    });
    const changes = await loadChanges(storeId, today);
    return { ok: true, campaigns: rows, changes, bizmoney: biz };
  } catch (e) {
    return { ok: false, error: `네이버에서 캠페인을 못 읽었어요: ${(e as Error).message}` };
  }
}

async function fetchBizmoney(acct: NaverAcct): Promise<number | null> {
  try {
    const r = await callNaver<{ bizmoney?: number }>(acct, "/billing/bizmoney");
    return r?.bizmoney ?? null;
  } catch {
    return null;
  }
}

async function log(storeId: string, c: Exclude<Ctx, { error: string }>, camp: NaverCampaign, field: "userLock" | "dailyBudget", before: string, after: string) {
  await createServiceClient().from("ad_change_logs").insert({
    store_id: storeId,
    user_id: c.userId,
    user_name: c.userName,
    target_type: "campaign",
    target_id: camp.nccCampaignId,
    target_name: camp.name,
    field,
    before_value: before,
    after_value: after,
  });
}

export async function toggleCampaign(storeId: string, campaignId: string, on: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await ctx(storeId);
  if (c.error !== undefined) return { ok: false, error: c.error };
  try {
    const before = (await listCampaigns(c.acct)).find((x) => x.nccCampaignId === campaignId);
    if (!before) return { ok: false, error: "캠페인을 찾을 수 없어요." };
    await setCampaignLock(c.acct, campaignId, !on);
    await log(storeId, c, before, "userLock", before.userLock ? "꺼짐" : "켜짐", on ? "켜짐" : "꺼짐");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `변경 실패: ${(e as Error).message}` };
  }
}

export async function setBudget(storeId: string, campaignId: string, dailyBudget: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await ctx(storeId);
  if (c.error !== undefined) return { ok: false, error: c.error };
  const budget = Math.round(Number(dailyBudget));
  if (!isFinite(budget) || budget < 0) return { ok: false, error: "예산은 0 이상 숫자로 넣어 주세요." };
  if (budget > 0 && budget < 1000) return { ok: false, error: "하루 예산은 1,000원 이상으로 넣어 주세요 (0 = 제한 없음)." };
  if (budget > 1_000_000) return { ok: false, error: "하루 100만원을 넘는 예산은 앱에서 못 바꿔요. 네이버 광고 시스템에서 직접 바꿔 주세요." };
  try {
    const before = (await listCampaigns(c.acct)).find((x) => x.nccCampaignId === campaignId);
    if (!before) return { ok: false, error: "캠페인을 찾을 수 없어요." };
    await setCampaignBudget(c.acct, campaignId, budget);
    const prev = before.useDailyBudget ? before.dailyBudget ?? 0 : 0;
    await log(storeId, c, before, "dailyBudget", String(prev), String(budget));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `변경 실패: ${(e as Error).message}` };
  }
}

/* ---------- 변경 이력 + 효과 판정 ---------- */
const JUDGE_BAND = 0.34; // 이 안의 변동은 판단 보류 (운영관리 앱 기준)

async function loadChanges(storeId: string, today: string): Promise<ChangeRow[]> {
  const service = createServiceClient();
  const { data: logs } = await service.from("ad_change_logs").select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(30);
  if (!logs?.length) return [];
  const from = addYmd(today, -90);
  const [{ data: toss }, { data: ad }] = await Promise.all([
    service.from("toss_daily_sales").select("date, sales").eq("store_id", storeId).gte("date", from),
    service.from("ad_daily_stats").select("date, cost").eq("store_id", storeId).gte("date", from),
  ]);
  const sales = new Map((toss ?? []).map((r) => [r.date, r.sales]));
  const cost = new Map((ad ?? []).map((r) => [r.date, r.cost]));
  const sum = (a: string, z: string) => {
    let s = 0;
    let c = 0;
    let n = 0;
    for (let d = a; d <= z; d = addYmd(d, 1)) {
      if (sales.has(d)) {
        s += sales.get(d) ?? 0;
        n++;
      }
      c += cost.get(d) ?? 0;
    }
    return { sales: s, cost: c, days: n, roas: s && c ? (s / c) * 100 : null };
  };
  return logs.map((l) => {
    const day = new Date(new Date(l.created_at).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const label = l.field === "userLock" ? `${l.before_value} → ${l.after_value}` : `하루 예산 ${Number(l.before_value).toLocaleString()}원 → ${Number(l.after_value).toLocaleString()}원`;
    const before = sum(addYmd(day, -7), addYmd(day, -1));
    const afterEnd = addYmd(day, 7) < addYmd(today, -1) ? addYmd(day, 7) : addYmd(today, -1);
    const after = sum(addYmd(day, 1), afterEnd);
    const daysAfter = Math.max(0, after.days);
    let effect: ChangeEffect | null = null;
    if (daysAfter < 7) {
      effect = { state: "pending", daysAfter, before, after, text: `판정까지 ${7 - daysAfter}일 남음 (다음 날부터 7일 비교)` };
    } else if (before.roas == null || after.roas == null) {
      effect = { state: "hold", daysAfter, before, after, text: "광고비 또는 매출 자료가 없어 판단 보류" };
    } else {
      const r = after.roas / before.roas - 1;
      const dSales = before.sales ? after.sales / before.sales - 1 : 0;
      const dCost = before.cost ? after.cost / before.cost - 1 : 0;
      const t = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`;
      if (Math.abs(r) <= JUDGE_BAND) effect = { state: "hold", daysAfter, before, after, text: `광고비 대비 매출 ${t(r)} — 변동이 작아 판단 보류 (매출 ${t(dSales)}, 광고비 ${t(dCost)})` };
      else if (r > 0) effect = { state: "better", daysAfter, before, after, text: `광고비 대비 매출 ${t(r)} 좋아짐 (매출 ${t(dSales)}, 광고비 ${t(dCost)})` };
      else effect = { state: "worse", daysAfter, before, after, text: `광고비 대비 매출 ${t(r)} 나빠짐 (매출 ${t(dSales)}, 광고비 ${t(dCost)})` };
    }
    return { ...l, effect, label };
  });
}
