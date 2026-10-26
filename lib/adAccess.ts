// 광고 리포트·효율 분석·광고 관리 시범 운영 범위.
// 성수LCDC 점장과 최종 점검을 마친 뒤 다른 지점장에게 열 예정이라, 그때까지는 본사 마스터 + 성수 점장만 본다.
// 전 매장에 열 때는 AD_PILOT_STORE_MATCH 를 null 로 바꾸면 된다.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export const AD_PILOT_STORE_MATCH: string | null = "성수";

type Profile = { role: string | null; store_id: string | null; department: string | null } | null | undefined;

/** 매장 이름을 이미 아는 경우(홈 화면 등). */
export function adReportAllowed(profile: Profile, storeName: string | null | undefined): boolean {
  if (!profile || profile.role !== "owner" || profile.department) return false;
  if (!profile.store_id) return true; // 본사 마스터
  if (!AD_PILOT_STORE_MATCH) return true;
  return !!storeName && storeName.includes(AD_PILOT_STORE_MATCH);
}

/** 서버 액션·페이지에서: 매장 이름을 조회해 판단한다. */
export async function adReportAllowedFor(supabase: SupabaseClient<Database>, profile: Profile): Promise<boolean> {
  if (!profile || profile.role !== "owner" || profile.department) return false;
  if (!profile.store_id || !AD_PILOT_STORE_MATCH) return true;
  const { data } = await supabase.from("stores").select("name").eq("id", profile.store_id).maybeSingle();
  return adReportAllowed(profile, data?.name);
}
