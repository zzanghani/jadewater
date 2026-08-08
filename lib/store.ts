import { cookies } from "next/headers";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Store } from "@/lib/types";

export const STORE_COOKIE = "store_id";

// 하남은 브레이크타임이 없고 몰 안에 있어 런치/디너 구분 및 인원 카운팅이
// 어려워서, 일 마감에서 런치/디너 객수 대신 총 방문팀수만 기입한다.
export function isHanamStore(name: string): boolean {
  return name.includes("하남");
}

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
