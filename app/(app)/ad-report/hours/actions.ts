"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { adReportAllowedFor } from "@/lib/adAccess";
import { kstYmd } from "@/lib/adReport";
import { analyzeHours, hoursRange, type HoursAnalysis } from "@/lib/adHours";

export type HoursResult = { ok: true; storeName: string; analysis: HoursAnalysis } | { ok: false; error: string };

export async function loadHours(storeId: string): Promise<HoursResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data: p } = await supabase.from("profiles").select("role, store_id, department, status").eq("id", user.id).maybeSingle();
  if (!p || p.status !== "approved" || p.department || p.role !== "owner" || (p.store_id && p.store_id !== storeId)) return { ok: false, error: "이 매장의 분석을 볼 권한이 없어요." };
  if (!(await adReportAllowedFor(supabase, p))) return { ok: false, error: "아직 시범 운영 중이라 이 계정에서는 볼 수 없어요." };

  const service = createServiceClient();
  const today = kstYmd(0);
  const { from, to } = hoursRange(today);
  const [{ data: store }, { data: acct }, { data: sales }, { data: ad }] = await Promise.all([
    supabase.from("stores").select("name").eq("id", storeId).maybeSingle(),
    service.from("store_ad_accounts").select("store_id").eq("store_id", storeId).eq("enabled", true).maybeSingle(),
    service.from("toss_daily_sales").select("date, by_hour, sales").eq("store_id", storeId).gte("date", from).lte("date", to),
    service.from("ad_hourly_stats").select("date, hour, imp, clk, cost").eq("store_id", storeId).gte("date", from).lte("date", to),
  ]);
  const analysis = analyzeHours({ from, to, sales: (sales ?? []).map((r) => ({ date: r.date, by_hour: r.by_hour as Record<string, number> | null, sales: r.sales })), ad: ad ?? [], adConnected: !!acct });
  return { ok: true, storeName: store?.name ?? "매장", analysis };
}
