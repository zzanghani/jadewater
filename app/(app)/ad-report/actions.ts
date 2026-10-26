"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adReportAllowedFor } from "@/lib/adAccess";
import { createServiceClient } from "@/lib/supabase/service";
import { testNaverAccount } from "@/lib/naverAds";
import {
  buildStoreReport,
  weekWindows,
  type AdStoreReport,
  type AdWeeklyReport,
  type SalesMap,
} from "@/lib/adReport";
import { addYmd } from "@/lib/adReport";
import type { Database } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdAccountFormState = { error?: string; success?: boolean; bizmoney?: number | null } | undefined;

function readInt(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").replace(/[^\d]/g, "");
  return raw ? Number(raw) : null;
}

async function requireHqMaster(supabase: SupabaseClient<Database>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("role, store_id, department, status").eq("id", user.id).maybeSingle();
  const ok = !!p && p.role === "owner" && !p.store_id && !p.department && p.status === "approved";
  return ok ? user : null;
}

// 매장 광고 키 저장 — 저장 전에 비즈머니 조회로 키가 맞는지 확인한다 (인수인계 7-1).
export async function saveAdAccount(_prev: AdAccountFormState, formData: FormData): Promise<AdAccountFormState> {
  const supabase = await createClient();
  const user = await requireHqMaster(supabase);
  if (!user) return { error: "본사 마스터 계정만 설정할 수 있어요." };

  const storeId = String(formData.get("store_id") ?? "");
  const customerId = String(formData.get("naver_customer_id") ?? "").trim();
  const apiKeyIn = String(formData.get("naver_api_key") ?? "").trim();
  const secretIn = String(formData.get("naver_secret_key") ?? "").trim();
  const enabled = formData.get("enabled") === "on";
  if (!storeId) return { error: "매장을 찾을 수 없어요." };
  if (!customerId) return { error: "고객 ID(CUSTOMER_ID)를 입력해 주세요." };

  // 키 칸을 비워두면 기존 키를 유지한다(마스킹된 값을 다시 적을 필요 없게).
  const { data: existing } = await supabase.from("store_ad_accounts").select("naver_api_key, naver_secret_key").eq("store_id", storeId).maybeSingle();
  const apiKey = apiKeyIn || existing?.naver_api_key || "";
  const secretKey = secretIn || existing?.naver_secret_key || "";
  if (!apiKey || !secretKey) return { error: "엑세스라이선스와 비밀키를 입력해 주세요." };

  const test = await testNaverAccount({ customerId, apiKey, secretKey });
  if (!test.ok) return { error: `네이버 연결 실패: ${test.error}` };

  const { error } = await supabase.from("store_ad_accounts").upsert(
    {
      store_id: storeId,
      naver_customer_id: customerId,
      naver_api_key: apiKey,
      naver_secret_key: secretKey,
      monthly_budget: readInt(formData, "monthly_budget"),
      target_cpa: readInt(formData, "target_cpa"),
      enabled,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "store_id" }
  );
  if (error) return { error: "저장에 실패했어요. 잠시 후 다시 시도해 주세요." };
  revalidatePath("/ad-report/settings");
  revalidatePath("/ad-report");
  return { success: true, bizmoney: test.bizmoney };
}

export async function deleteAdAccount(storeId: string): Promise<void> {
  const supabase = await createClient();
  if (!(await requireHqMaster(supabase))) return;
  await supabase.from("store_ad_accounts").delete().eq("store_id", storeId);
  revalidatePath("/ad-report/settings");
  revalidatePath("/ad-report");
}

/** 마감입력 매출을 'YYYY-MM-DD' → grand_total 로. 지난 1년 + 지난주까지. */
export async function loadSalesMap(
  supabase: SupabaseClient<Database>,
  storeId: string,
  from: string,
  to: string
): Promise<SalesMap> {
  const { data } = await supabase.from("daily_closings").select("date, grand_total").eq("store_id", storeId).gte("date", from).lte("date", to);
  const map: SalesMap = {};
  for (const r of data ?? []) map[r.date] = r.grand_total ?? 0;
  return map;
}

export type BuildResult = { ok: true; report: AdWeeklyReport } | { ok: false; error: string };

/**
 * 리포트 생성(화면용). 호출한 사람이 볼 수 있는 매장만 만든다.
 * 키는 서비스 키로 읽되(지점장은 키 테이블을 못 보니까) 본인 매장인지 먼저 확인한다.
 * 같은 주 저장본이 6시간 안이면 그대로 쓰고, refresh면 새로 만든다.
 */
export async function buildAdReportAction(refresh = false): Promise<BuildResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data: profile } = await supabase.from("profiles").select("role, store_id, department, status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "approved" || profile.department || profile.role !== "owner") {
    return { ok: false, error: "지점장·대표 계정만 볼 수 있어요." };
  }
  if (!(await adReportAllowedFor(supabase, profile))) return { ok: false, error: "광고 리포트는 아직 시범 운영 중이라 이 계정에서는 볼 수 없어요." };

  const service = createServiceClient();
  let q = service.from("store_ad_accounts").select("*").eq("enabled", true);
  if (profile.store_id) q = q.eq("store_id", profile.store_id);
  const { data: accounts } = await q;
  if (!accounts?.length) return { ok: false, error: profile.store_id ? "이 매장은 아직 광고 계정이 연결되지 않았어요. 대표님께 요청해 주세요." : "연결된 광고 계정이 없어요. 설정에서 매장 키를 등록해 주세요." };

  const { data: storeRows } = await supabase.from("stores").select("id, name").in("id", accounts.map((a) => a.store_id));
  const nameById = new Map((storeRows ?? []).map((s) => [s.id, s.name]));
  const W = weekWindows();

  const stores: AdStoreReport[] = [];
  for (const a of accounts) {
    const name = nameById.get(a.store_id) ?? "매장";
    if (!refresh) {
      const { data: cached } = await supabase.from("ad_weekly_reports").select("report, generated_at").eq("store_id", a.store_id).eq("week_start", W.week[0]).maybeSingle();
      if (cached && Date.now() - new Date(cached.generated_at).getTime() < 6 * 3600e3) {
        stores.push(cached.report as unknown as AdStoreReport);
        continue;
      }
    }
    try {
      const sales = await loadSalesMap(supabase, a.store_id, addYmd(W.yesterday, -370), W.yesterday);
      const r = await buildStoreReport({
        storeId: a.store_id,
        name,
        acct: { customerId: a.naver_customer_id, apiKey: a.naver_api_key, secretKey: a.naver_secret_key },
        budget: a.monthly_budget,
        targetCpa: a.target_cpa,
        sales: Object.keys(sales).length ? sales : null,
        W,
      });
      await supabase.from("ad_weekly_reports").upsert(
        { store_id: a.store_id, week_start: W.week[0], report: r as unknown as Record<string, unknown>, generated_at: new Date().toISOString() },
        { onConflict: "store_id,week_start" }
      );
      stores.push(r);
    } catch (e) {
      stores.push({ storeId: a.store_id, name, error: (e as Error).message } as AdStoreReport);
    }
  }

  return {
    ok: true,
    report: { generatedAt: Date.now(), week: W.week, prev: W.prev, mtd: W.mtd, monthDays: W.monthDays, monthElapsed: W.monthElapsed, stores },
  };
}
