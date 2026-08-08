import type { createClient } from "@/lib/supabase/server";

export type FrequentAccount = {
  vendor_name: string;
  bank_name: string | null;
  account_number: string;
  count: number;
};

// 이 매장이 과거에 올린 입금요청에서 거래처+계좌번호 기준으로 가장 자주
// 쓴 순서로 상위 N개를 뽑는다. 별도로 관리하는 주소록이 아니라 실제
// 입력 이력에서 바로 뽑기 때문에 새로 등록/관리할 필요가 없다.
export async function getFrequentAccounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  limit = 20
): Promise<FrequentAccount[]> {
  const { data } = await supabase
    .from("payment_requests")
    .select("vendor_name, bank_name, account_number")
    .eq("store_id", storeId)
    .not("account_number", "is", null);

  const map = new Map<string, FrequentAccount>();
  for (const r of data ?? []) {
    if (!r.account_number) continue;
    const key = `${r.vendor_name}__${r.account_number}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        vendor_name: r.vendor_name,
        bank_name: r.bank_name,
        account_number: r.account_number,
        count: 1,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
