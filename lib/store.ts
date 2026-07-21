import { cookies } from "next/headers";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Store } from "@/lib/types";

export const STORE_COOKIE = "store_id";

export type StoreContext = {
  storeId: string;
  storeName: string;
  stores: Store[];
};

// 쿠키에 저장된 매장을 우선 사용하고, 없거나 유효하지 않으면 첫 번째 매장으로 대체한다.
// React cache()로 감싸서 같은 요청 안에서 레이아웃/페이지가 각자 호출해도
// stores 조회는 한 번만 나가게 한다 (createClient()도 cache()되어 있어
// 같은 요청이면 매번 같은 supabase 인스턴스가 들어온다).
export const getStoreContext = cache(async function getStoreContext(
  supabase: SupabaseClient<Database>
): Promise<StoreContext> {
  const { data } = await supabase
    .from("stores")
    .select("*")
    .order("sort_order");
  const stores = data ?? [];

  const cookieStore = await cookies();
  const cookieId = cookieStore.get(STORE_COOKIE)?.value;
  const current = stores.find((s) => s.id === cookieId) ?? stores[0];

  return {
    storeId: current?.id ?? "",
    storeName: current?.name ?? "",
    stores,
  };
})
