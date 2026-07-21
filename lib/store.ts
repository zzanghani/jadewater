import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Store } from "@/lib/types";

export const STORE_COOKIE = "store_id";

export type StoreContext = {
  storeId: string;
  storeName: string;
  stores: Store[];
};

// 쿠키에 저장된 매장을 우선 사용하고, 없거나 유효하지 않으면 첫 번째 매장으로 대체한다.
export async function getStoreContext(
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
}
