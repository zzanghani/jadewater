// 광고 리포트·효율 분석·광고 관리 공개 범위.
// 2026-11-01 시범 운영 끝 — 전 매장 지점장(매장 소속 owner)에게 열었다. 매장 키 설정 화면은 여전히 본사 마스터만.
// 2026-11-01 지점장은 같은 브랜드 매장(제이드앤워터끼리, 정다미끼리)의 광고 데이터를 다 본다.
//   보기: 마스터 = 전 매장, 지점장 = 같은 브랜드 매장 전부
//   고치기(캠페인 켜고 끄기·예산·노출 시간·광고 키워드·원가율·특이일·추적 키워드): 마스터 또는 자기 매장만
// - 특정 매장 점장에게만 열려면 AD_PILOT_STORE_MATCH 에 매장 이름 일부("성수" 등)
// - 전 매장에 열려면 AD_PILOT_STORE_MATCH 를 null 로
// - 마스터만 보게 하려면 "" (빈 문자열) — 어떤 매장 이름과도 안 맞음
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export const AD_PILOT_STORE_MATCH: string | null = null;

/** 광고 화면 매장 선택 쿠키 — 전역 매장 선택(store_id)과 따로 둔다. 지점장은 전역 선택이 자기 매장 하나뿐이라서. */
export const AD_STORE_COOKIE = "ad_store_id";

type Profile = { role: string | null; store_id: string | null; department: string | null } | null | undefined;

export type AdStore = { id: string; name: string; brand_id: string };

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

/**
 * 광고 화면에서 볼 수 있는 매장 목록 (브랜드 → 매장 순).
 * stores 테이블은 RLS로 지점장에게 자기 매장만 보이므로 서비스 클라이언트로 읽고 여기서 브랜드로 거른다.
 */
export async function adVisibleStores(service: SupabaseClient<Database>, profile: Profile): Promise<AdStore[]> {
  if (!profile || profile.role !== "owner" || profile.department) return [];
  const [{ data: stores }, { data: brands }] = await Promise.all([
    service.from("stores").select("id, name, brand_id, sort_order"),
    service.from("brands").select("id, sort_order"),
  ]);
  const brandOrder = new Map((brands ?? []).map((b) => [b.id, b.sort_order]));
  const all = (stores ?? [])
    .slice()
    .sort((a, b) => {
      const ba = brandOrder.get(a.brand_id) ?? Number.MAX_SAFE_INTEGER;
      const bb = brandOrder.get(b.brand_id) ?? Number.MAX_SAFE_INTEGER;
      return ba !== bb ? ba - bb : a.sort_order - b.sort_order;
    })
    .map(({ id, name, brand_id }) => ({ id, name, brand_id }));
  if (!profile.store_id) return all; // 본사 마스터: 전 매장
  const mine = all.find((s) => s.id === profile.store_id);
  if (!mine) return [];
  return all.filter((s) => s.brand_id === mine.brand_id); // 같은 브랜드 매장
}

/** 이 매장의 광고 데이터를 볼 수 있나 (마스터 전부, 지점장은 같은 브랜드). */
export async function adCanView(service: SupabaseClient<Database>, profile: Profile, storeId: string): Promise<boolean> {
  if (!profile || profile.role !== "owner" || profile.department) return false;
  if (!profile.store_id) return true;
  if (profile.store_id === storeId) return true;
  const list = await adVisibleStores(service, profile);
  return list.some((s) => s.id === storeId);
}

/** 이 매장의 광고 설정을 바꿀 수 있나 (마스터 또는 자기 매장). */
export function adCanEdit(profile: Profile, storeId: string): boolean {
  if (!profile || profile.role !== "owner" || profile.department) return false;
  return !profile.store_id || profile.store_id === storeId;
}

export const AD_EDIT_DENIED = "다른 매장의 광고 설정은 그 매장 지점장이나 대표님만 바꿀 수 있어요.";

/**
 * 광고 하위 화면(효율 분석·관리·검색 노출·시간대)에서 보여줄 매장을 정한다.
 * 쿠키(ad_store_id)에 고른 매장이 볼 수 있는 목록에 있으면 그 매장, 아니면 자기 매장(마스터는 전역 선택 매장 → 첫 매장).
 */
export function pickAdStore(stores: AdStore[], profile: Profile, cookieId: string | undefined, contextStoreId: string): string {
  if (cookieId && stores.some((s) => s.id === cookieId)) return cookieId;
  if (profile?.store_id && stores.some((s) => s.id === profile.store_id)) return profile.store_id;
  if (contextStoreId && stores.some((s) => s.id === contextStoreId)) return contextStoreId;
  return stores[0]?.id ?? contextStoreId;
}
