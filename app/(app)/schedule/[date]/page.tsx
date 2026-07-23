import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { kstDateLabel } from "@/lib/date";
import { roleColor } from "@/lib/scheduleColors";
import ScheduleShiftForm from "@/components/ScheduleShiftForm";
import DeleteShiftButton from "@/components/DeleteShiftButton";

export default async function ScheduleDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const supabase = await createClient();
  const { storeId } = await getStoreContext(supabase);

  const { data: shifts } = await supabase
    .from("schedule_shifts")
    .select("*")
    .eq("store_id", storeId)
    .eq("date", date)
    .order("start_time", { ascending: true });

  const rows = shifts ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/schedule?month=${date.slice(0, 7)}`}
        className="flex items-center gap-1 text-sm font-medium text-muted"
      >
        <span aria-hidden>←</span> 달력으로
      </Link>

      <h1 className="text-lg font-bold">{kstDateLabel(date)} 근무자</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">등록된 근무자가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                style={{ backgroundColor: roleColor(s.role) }}
              >
                {s.role}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{s.employee_name}</p>
                <p className="text-xs text-muted">
                  {s.start_time.slice(0, 5)} ~ {s.end_time.slice(0, 5)}
                  {s.notes ? ` · ${s.notes}` : ""}
                </p>
              </div>
              <DeleteShiftButton id={s.id} date={date} />
            </li>
          ))}
        </ul>
      )}

      <ScheduleShiftForm date={date} />
    </div>
  );
}
