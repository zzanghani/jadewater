import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { kstDateString } from "@/lib/date";
import { getStoreContext } from "@/lib/store";
import ReceiptForm from "@/components/ReceiptForm";
import DeleteReceiptButton from "@/components/DeleteReceiptButton";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const supabase = await createClient();
  const { storeId } = await getStoreContext(supabase);
  const today = kstDateString(0);

  const { data: todayReceipts } = await supabase
    .from("receipts")
    .select("*")
    .eq("store_id", storeId)
    .eq("date", today)
    .order("created_at", { ascending: false });

  const editing = edit
    ? (todayReceipts ?? []).find((r) => r.id === edit)
    : undefined;

  const total = (todayReceipts ?? []).reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="mb-3 text-lg font-bold">
          {editing ? "입고 수정" : "입고 입력"}
        </h1>
        <ReceiptForm key={editing?.id ?? "new"} storeId={storeId} existing={editing} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          오늘 입고 내역
        </h2>
        {!todayReceipts?.length ? (
          <p className="text-sm text-muted">오늘 등록된 입고 내역이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {todayReceipts.map((r) => (
              <li
                key={r.id}
                className={`rounded-2xl border bg-card p-4 ${
                  r.id === editing?.id ? "border-brand" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{r.supplier}</span>
                  <span className="text-sm font-bold text-brand">
                    {formatWon(r.amount)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-medium text-brand-dark">
                    {r.category}
                  </span>
                  {r.items && (
                    <span className="truncate text-xs text-muted">
                      {r.items}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-end gap-1 border-t border-border pt-2">
                  <Link
                    href={`/receipts?edit=${r.id}`}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-brand"
                  >
                    수정
                  </Link>
                  <DeleteReceiptButton id={r.id} />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-light px-4 py-3 text-sm">
          <span className="font-medium text-brand-dark">오늘 입고 합계</span>
          <span className="text-base font-bold text-brand-dark">
            {formatWon(total)}
          </span>
        </div>
      </section>
    </div>
  );
}
