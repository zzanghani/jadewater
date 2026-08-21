import type { createClient } from "@/lib/supabase/server";

export type RecentSupplier = { supplier: string; lastUsedAt: string; count: number };

// 이 매장이 과거에 등록한 입고 내역에서 거래처명을 뽑아, 가장 최근에
// 쓴 순서로 상위 N개를 돌려준다. 별도로 관리하는 주소록이 아니라 실제
// 입력 이력에서 바로 뽑기 때문에 새로 등록/관리할 필요가 없다
// (입금요청의 "자주쓰는 계좌"와 같은 방식).
export async function getRecentSuppliers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  limit = 20
): Promise<RecentSupplier[]> {
  const [{ data }, { data: hidden }] = await Promise.all([
    supabase
      .from("receipts")
      .select("supplier, date")
      .eq("store_id", storeId)
      .order("date", { ascending: false })
      .limit(500),
    supabase.from("hidden_suppliers").select("supplier").eq("store_id", storeId),
  ]);
  const hiddenNames = new Set((hidden ?? []).map((h) => h.supplier));

  const map = new Map<string, RecentSupplier>();
  for (const r of data ?? []) {
    if (!r.supplier || hiddenNames.has(r.supplier)) continue;
    const existing = map.get(r.supplier);
    if (existing) {
      existing.count += 1;
      if (r.date > existing.lastUsedAt) existing.lastUsedAt = r.date;
    } else {
      map.set(r.supplier, { supplier: r.supplier, lastUsedAt: r.date, count: 1 });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, limit);
}
