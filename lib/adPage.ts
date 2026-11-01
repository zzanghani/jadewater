import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStoreContext } from "@/lib/store";
import { AD_STORE_COOKIE, adAccountOk, adCanEdit, adIsHq, adReportAllowedFor, adVisibleStores, pickAdStore, type AdStore } from "@/lib/adAccess";

export type AdPageScope = {
  /** 지금 보여줄 매장 */
  storeId: string;
  /** 머리글 매장 선택에 올릴 매장들 (마스터 전부, 지점장은 같은 브랜드) */
  stores: AdStore[];
  /** 이 매장 설정을 바꿀 수 있나 (마스터 또는 자기 매장) */
  canEdit: boolean;
  isHqMaster: boolean;
};

// 광고 하위 화면 공통: 로그인·권한 확인 → 볼 수 있는 매장 목록 → 머리글에서 고른 매장.
export async function resolveAdPageScope(): Promise<AdPageScope> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { storeId: contextStoreId }, cookieStore] = await Promise.all([
    supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle(),
    getStoreContext(supabase),
    cookies(),
  ]);
  if (!adAccountOk(profile)) redirect("/");
  if (!(await adReportAllowedFor(supabase, profile))) redirect("/");
  const stores = await adVisibleStores(createServiceClient(), profile);
  const storeId = pickAdStore(stores, profile, cookieStore.get(AD_STORE_COOKIE)?.value, contextStoreId);
  return { storeId, stores, canEdit: adCanEdit(profile, storeId), isHqMaster: adIsHq(profile) };
}
