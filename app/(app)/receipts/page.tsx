import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { kstDateString, kstDateLabel, shiftDateString } from "@/lib/date";
import { getStoreContext } from "@/lib/store";
import ReceiptForm from "@/components/ReceiptForm";
import DeleteReceiptButton from "@/components/DeleteReceiptButton";
import ReceiptDateJump from "@/components/ReceiptDateJump";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; date?: string }>;
}) {
  const { edit, date: dateParam } = await searchParams;
  const supabase = await createClient();
  const { storeId } = await getStoreContext(supabase);
  const today = kstDateString(0);
  const selectedDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today
      ? dateParam
      : today;
  const isToday = selectedDate === today;
  const prevDate = shiftDateString(selectedDate, -1);
  const nextDate = shiftDateString(selectedDate, 1);

  const { data: dayReceipts } = await supabase
    .from("receipts")
    .select("*")
    .eq("store_id", storeId)
    .eq("date", selectedDate)
    .order("created_at", { ascending: false });

  const editing = edit
    ? (dayReceipts ?? []).find((r) => r.id === edit)
    : undefined;

  const total = (dayReceipts ?? []).reduce((sum, r) => sum + r.amount, 0);
  const dateQuery = selectedDate === today ? "" : `?date=${selectedDate}`;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="mb-3 text-lg font-bold">
          {editing ? "입고 수정" : "입고 입력"}
        </h1>
        <ReceiptForm
          key={editing?.id ?? selectedDate}
          storeId={storeId}
          existing={editing}
          defaultDate={selectedDate}
          cancelHref={`/receipts${dateQuery}`}
        />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {isToday ? "오늘" : kstDateLabel(selectedDate)} 입고 내역
          </h2>
          <div className="flex items-center gap-1">
            <Link
              href={`/receipts?date=${prevDate}`}
              className="rounded-full border border-border px-2 py-0.5 text-sm text-muted"
            >
              ‹
            </Link>
            <ReceiptDateJump date={selectedDate} />
            {!isToday && (
              <Link
                href={`/receipts?date=${nextDate}`}
                className="rounded-full border border-border px-2 py-0.5 text-sm text-muted"
              >
                ›
              </Link>
            )}
          </div>
        </div>
        {!dayReceipts?.length ? (
          <p className="text-sm text-muted">
            {isToday ? "오늘" : kstDateLabel(selectedDate)} 등록된 입고 내역이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dayReceipts.map((r) => (
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
                    href={`/receipts?edit=${r.id}${isToday ? "" : `&date=${selectedDate}`}`}
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
          <span className="font-medium text-brand-dark">
            {isToday ? "오늘" : kstDateLabel(selectedDate)} 입고 합계
          </span>
          <span className="text-base font-bold text-brand-dark">
            {formatWon(total)}
          </span>
        </div>
      </section>
    </div>
  );
}
