// 광고 리포트·효율 분석·광고 관리 공개 범위.
// 2026-11-01 시범 운영 끝 — 전 매장 지점장(매장 소속 owner)에게 열었다. 매장 키 설정 화면은 여전히 본사 마스터만.
// - 특정 매장 점장에게만 열려면 AD_PILOT_STORE_MATCH 에 매장 이름 일부("성수" 등)
// - 전 매장에 열려면 AD_PILOT_STORE_MATCH 를 null 로
// - 마스터만 보게 하려면 "" (빈 문자열) — 어떤 매장 이름과도 안 맞음
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export const AD_PILOT_STORE_MATCH: string | null = null;

type Profile = { role: string | null; store_id: string | null; department: string | null } | null | undefined;

/** 매장 이름을 이미 아는 경우(홈 화면 등). */
export function adReportAllowed(profile: Profile, storeName: string | null | undefined): boolean {
  if (!profile || profile.role !== "owner" || profile.department) return false;
  if (!profile.store_id) return true; // 본사 마스터
  if (AD_PILOT_STORE_MATCH === null) return true; // 전 매장 개방
  if (AD_PILOT_STORE_MATCH === "") return false; // 마스터만
  return !!storeName && storeName.includes(AD_PILOT_STORE_MATCH);
}

/** 서버 액션·페이지에서: 매장 이름을 조회해 판단한다. */
export async function adReportAllowedFor(supabase: SupabaseClient<Database>, profile: Profile): Promise<boolean> {
  if (!profile || profile.role !== "owner" || profile.department) return false;
  if (!profile.store_id || AD_PILOT_STORE_MATCH === null) return true;
  if (AD_PILOT_STORE_MATCH === "") return false;
  const { data } = await supabase.from("stores").select("name").eq("id", profile.store_id).maybeSingle();
  return adReportAllowed(profile, data?.name);
}
