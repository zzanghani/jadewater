import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { buildKakaoMessage } from "@/lib/kakao";
import { getStoreContext } from "@/lib/store";
import PaymentForm from "@/components/PaymentForm";
import CopyButton from "@/components/CopyButton";

export default async function PaymentPage() {
  const supabase = await createClient();
  const { storeId } = await getStoreContext(supabase);

  const { data: history } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="mb-3 text-lg font-bold">입금요청</h1>
        <PaymentForm storeId={storeId} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          최근 요청 내역
        </h2>
        {!history?.length ? (
          <p className="text-sm text-muted">아직 등록된 요청이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((r) => {
              const requestDate = new Date(r.created_at).toLocaleDateString(
                "ko-KR",
                { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }
              );
              const message = buildKakaoMessage({
                vendorName: r.vendor_name,
                amount: r.amount,
                bankName: r.bank_name ?? undefined,
                accountNumber: r.account_number ?? undefined,
                date: requestDate,
              });
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {r.vendor_name}
                    </p>
                    <p className="text-xs text-muted">
                      {formatWon(r.amount)} · {requestDate}
                    </p>
                  </div>
                  <CopyButton text={message} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
