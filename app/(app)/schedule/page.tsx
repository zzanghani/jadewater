import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import {
  daysInMonthKST,
  kstDateString,
  kstWeekday,
  monthRangeFromMonthString,
  shiftMonthString,
} from "@/lib/date";
import { SCHEDULE_ROLES, roleColor } from "@/lib/scheduleColors";
import type { ScheduleRole } from "@/lib/types";

const WEEKDAY_HEADER = ["일", "월", "화", "수", "목", "금", "토"];

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const today = kstDateString(0);
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const range = monthRangeFromMonthString(month);
  const days = daysInMonthKST(range.start);

  const supabase = await createClient();
  const { storeId } = await getStoreContext(supabase);

  const { data: shifts } = await supabase
    .from("schedule_shifts")
    .select("date, role")
    .eq("store_id", storeId)
    .gte("date", range.start)
    .lte("date", range.end);

  const rolesByDate = new Map<string, Set<ScheduleRole>>();
  for (const s of shifts ?? []) {
    const set = rolesByDate.get(s.date) ?? new Set<ScheduleRole>();
    set.add(s.role);
    rolesByDate.set(s.date, set);
  }

  const firstWeekday = kstWeekday(days[0]);
  const leadingBlanks = Array.from({ length: firstWeekday }, () => null);
  const cells = [...leadingBlanks, ...days];
  const trailingCount = (7 - (cells.length % 7)) % 7;
  const trailingBlanks = Array.from({ length: trailingCount }, () => null);
  const allCells = [...cells, ...trailingBlanks];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">스케줄러</h1>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-card p-1.5">
        <Link
          href={`/schedule?month=${shiftMonthString(month, -1)}`}
          aria-label="이전달"
          className="rounded-xl px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-foreground"
        >
          ←
        </Link>
        <span className="text-sm font-bold">{range.label}</span>
        <Link
          href={`/schedule?month=${shiftMonthString(month, 1)}`}
          aria-label="다음달"
          className="rounded-xl px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-foreground"
        >
          →
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
        {WEEKDAY_HEADER.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {allCells.map((date, idx) => {
          if (!date) return <div key={`blank-${idx}`} />;
          const isToday = date === today;
          const roles = [...(rolesByDate.get(date) ?? [])];
          return (
            <Link
              key={date}
              href={`/schedule/${date}`}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2 transition-colors ${
                isToday
                  ? "border-brand bg-brand-light"
                  : "border-border bg-card hover:border-brand"
              }`}
            >
              <span
                className={`text-xs font-semibold ${
                  isToday ? "text-brand" : "text-foreground"
                }`}
              >
                {Number(date.slice(-2))}
              </span>
              <div className="flex min-h-[6px] flex-wrap items-center justify-center gap-0.5">
                {roles.slice(0, 5).map((r) => (
                  <span
                    key={r}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: roleColor(r) }}
                  />
                ))}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 rounded-2xl border border-border bg-card p-3 text-[11px] text-muted">
        {SCHEDULE_ROLES.map((r) => (
          <span key={r} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: roleColor(r) }} />
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}
