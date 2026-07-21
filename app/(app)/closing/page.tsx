import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { kstDateLabel, kstDateString } from "@/lib/date";
import { getStoreContext } from "@/lib/store";
import ClosingForm from "@/components/ClosingForm";

export default async function ClosingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const supabase = await createClient();
  const { storeId } = await getStoreContext(supabase);
  const today = kstDateString(0);
  const isValidDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today;
  const targetDate = isValidDate ? dateParam : today;
  const isEditingPast = targetDate !== today;

  const [{ data: targetClosing }, { data: history }] = await Promise.all([
    supabase
      .from("daily_closings")
      .select("*")
      .eq("store_id", storeId)
      .eq("date", targetDate)
      .maybeSingle(),
    supabase
      .from("daily_closings")
      .select("*")
      .eq("store_id", storeId)
      .order("date", { ascending: false })
      .limit(14),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">
            {isEditingPast ? `${kstDateLabel(targetDate)} 마감 수정` : "일 마감 입력"}
          </h1>
          {isEditingPast && (
            <Link href="/closing" className="text-sm font-medium text-brand">
              오늘로 돌아가기
            </Link>
          )}
        </div>
        <ClosingForm
          key={targetDate}
          storeId={storeId}
          existing={targetClosing ?? undefined}
          defaultDate={targetDate}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">최근 마감 내역</h2>
        {!history?.length ? (
          <p className="text-sm text-muted">아직 등록된 마감 내역이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/closing?date=${c.date}`}
                  className={`block rounded-2xl border p-4 transition-colors ${
                    c.date === targetDate
                      ? "border-brand bg-brand-light"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {kstDateLabel(c.date)}
                    </span>
                    <span className="text-sm font-bold text-brand">
                      {formatWon(c.grand_total)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
                    <span>총객수 {c.total_guests.toLocaleString()}명</span>
                    <span>결제 {formatWon(c.payment_sales_total)}</span>
                    <span>카테고리 {formatWon(c.category_sales_total)}</span>
                    <span>배달 {formatWon(c.delivery_sales_total)}</span>
                  </div>
                  {c.notes && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted">
                      {c.notes}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
