import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { kstDateString, monthRangeFromMonthString, shiftMonthString } from "@/lib/date";
import PayrollEditor from "@/components/PayrollEditor";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const supabase = await createClient();
  const { storeId, storeName } = await getStoreContext(supabase);

  const currentMonth = kstDateString(0).slice(0, 7);
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth;
  const prevMonth = shiftMonthString(month, -1);
  const nextMonth = shiftMonthString(month, 1);
  const { label } = monthRangeFromMonthString(month);

  const [{ data: rows }, { count: prevCount }] = await Promise.all([
    supabase
      .from("payroll_entries")
      .select("*")
      .eq("store_id", storeId)
      .eq("month", `${month}-01`)
      .order("created_at"),
    supabase
      .from("payroll_entries")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("month", `${prevMonth}-01`),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">급여신고</h1>
        <p className="mt-1 text-xs text-muted">{storeName} · 직원별 월 급여 내역</p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-2 py-2">
        <Link
          href={`/payroll?month=${prevMonth}`}
          className="rounded-xl px-3 py-1.5 text-sm font-semibold text-muted"
          aria-label="이전 달"
        >
          ‹
        </Link>
        <span className="text-sm font-bold">{label}</span>
        {month < currentMonth ? (
          <Link
            href={`/payroll?month=${nextMonth}`}
            className="rounded-xl px-3 py-1.5 text-sm font-semibold text-muted"
            aria-label="다음 달"
          >
            ›
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-sm text-border">›</span>
        )}
      </div>

      <PayrollEditor
        key={`${storeId}-${month}`}
        storeId={storeId}
        month={month}
        rows={rows ?? []}
        hasPreviousMonth={(prevCount ?? 0) > 0}
      />
    </div>
  );
}
