import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { kstDateLabel, kstDateString, last7DaysKST } from "@/lib/date";
import { getStoreContext } from "@/lib/store";
import ClosingForm from "@/components/ClosingForm";

export default async function ClosingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const supabase = await createClient();
  const { storeId, store } = await getStoreContext(supabase);
  const isHanam = !(store?.uses_service_split ?? true);
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

  // 최근 7일 중 오늘을 뺀, 아직 마감보고가 없는 날.
  // 날짜는 폼에서 바꿀 수 있지만 그걸 모르고 지나치는 지점장이 있어서 눈에 띄게 알려준다.
  const writtenDates = new Set((history ?? []).map((c) => c.date));
  const missingDates = last7DaysKST()
    .filter((d) => d !== today && !writtenDates.has(d))
    .reverse();

  return (
    <div className="flex flex-col gap-6">
      {missingDates.length > 0 && targetDate === today && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">아직 안 쓴 마감보고가 있어요</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missingDates.map((d) => (
              <Link
                key={d}
                href={`/closing?date=${d}`}
                className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-amber-800 ring-1 ring-amber-300"
              >
                {kstDateLabel(d)} 쓰기
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">
            {isEditingPast
              ? `${kstDateLabel(targetDate)} 마감 ${targetClosing ? "수정" : "입력"}`
              : "일 마감 입력"}
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
          isHanam={isHanam}
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
                    <span>
                      {isHanam
                        ? `방문팀 ${(c.visit_teams ?? 0).toLocaleString()}팀`
                        : `총객수 ${(c.total_teams ?? 0).toLocaleString()}팀 · ${c.total_guests.toLocaleString()}명`}
                    </span>
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
