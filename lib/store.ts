import { cookies } from "next/headers";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Brand, Store } from "@/lib/types";

export const STORE_COOKIE = "store_id";

export type StoreContext = {
  storeId: string;
  storeName: string;
  /** 현재 선택된 매장 행 전체. 매장별 설정(런치/디너 분리, 색 등)을 여기서 읽는다. */
  store: Store | null;
  /** 현재 매장이 속한 브랜드. 헤더 로고와 화면 톤을 여기서 읽는다. */
  brand: Brand | null;
  stores: Store[];
  /** 볼 수 있는 매장들이 속한 브랜드 목록 (매장 선택 드롭다운 그룹핑용). */
  brands: Brand[];
};

// 쿠키에 저장된 매장을 우선 사용하고, 없거나 유효하지 않으면 첫 번째 매장으로 대체한다.
// React cache()로 감싸서 같은 요청 안에서 레이아웃/페이지가 각자 호출해도
// 조회는 한 번만 나가게 한다 (createClient()도 cache()되어 있어
// 같은 요청이면 매번 같은 supabase 인스턴스가 들어온다).
//
// stores는 RLS로 걸러져서 지점장/직원은 자기 매장 한 개만, 마스터는 전 매장이
// 보인다. brands는 로고·톤 같은 표시용 정보뿐이라 전부 읽고, 여기서 실제로
// 보이는 매장의 브랜드만 남긴다.
export const getStoreContext = cache(async function getStoreContext(
  supabase: SupabaseClient<Database>
): Promise<StoreContext> {
  const [{ data: storeRows }, { data: brandRows }] = await Promise.all([
    supabase.from("stores").select("*").order("sort_order"),
    supabase.from("brands").select("*").order("sort_order"),
  ]);
  const allBrands = brandRows ?? [];

  // 브랜드 → 매장 순으로 정렬해서, 마스터 화면의 매장 목록이 브랜드별로 묶인다.
  const brandOrder = new Map(allBrands.map((b) => [b.id, b.sort_order]));
  const stores = (storeRows ?? []).slice().sort((a, b) => {
    const ba = brandOrder.get(a.brand_id) ?? Number.MAX_SAFE_INTEGER;
    const bb = brandOrder.get(b.brand_id) ?? Number.MAX_SAFE_INTEGER;
    return ba !== bb ? ba - bb : a.sort_order - b.sort_order;
  });

  const cookieStore = await cookies();
  const cookieId = cookieStore.get(STORE_COOKIE)?.value;
  const current = stores.find((s) => s.id === cookieId) ?? stores[0] ?? null;

  const visibleBrandIds = new Set(stores.map((s) => s.brand_id));
  const brands = allBrands.filter((b) => visibleBrandIds.has(b.id));

  return {
    storeId: current?.id ?? "",
    storeName: current?.name ?? "",
    store: current,
    brand: allBrands.find((b) => b.id === current?.brand_id) ?? null,
    stores,
    brands,
  };
})
