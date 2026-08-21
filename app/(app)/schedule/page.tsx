import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { kstDateString, shiftDateString, mondayOfWeekKST, mondayWeekDatesKST } from "@/lib/date";
import { SCHEDULE_ROLES, roleColor } from "@/lib/scheduleColors";
import ScheduleDayTimeline from "@/components/ScheduleDayTimeline";
import ScheduleWeekGrid, { type WeekGridRow } from "@/components/ScheduleWeekGrid";
import type { ScheduleRole } from "@/lib/types";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: weekParam } = await searchParams;
  const today = kstDateString(0);

  const weekStart =
    weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? mondayOfWeekKST(weekParam)
      : mondayOfWeekKST(today);
  const weekDates = mondayWeekDatesKST(weekStart);
  // 그 주에 근무가 없어도(휴무만 있는 주 등) 이름이 계속 보이도록, 최근
  // 90일치 이력에서 등장한 이름을 명단으로 삼는다(별도 직원 마스터 없음).
  const rosterStart = shiftDateString(weekStart, -90);

  const supabase = await createClient();
  const { storeId } = await getStoreContext(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isEmployee = profile?.role === "staff";

  const [{ data: todayShifts }, { data: weekShifts }, { data: rosterShifts }] =
    await Promise.all([
      supabase
        .from("schedule_shifts")
        .select("*")
        .eq("store_id", storeId)
        .eq("date", today)
        .order("created_at", { ascending: true }),
      supabase
        .from("schedule_shifts")
        .select("*")
        .eq("store_id", storeId)
        .gte("date", weekStart)
        .lte("date", weekDates[6]),
      supabase
        .from("schedule_shifts")
        .select("employee_name, role, created_at")
        .eq("store_id", storeId)
        .gte("date", rosterStart)
        .lte("date", weekDates[6])
        .order("created_at", { ascending: true }),
    ]);

  // 등장 순서(처음 나온 날짜 오름차순)대로 이름을 명단에 올리고, 직급은
  // 가장 최근 근무 기준으로 표시한다.
  const roleByName = new Map<string, ScheduleRole>();
  const nameOrder: string[] = [];
  for (const s of rosterShifts ?? []) {
    if (!roleByName.has(s.employee_name)) nameOrder.push(s.employee_name);
    roleByName.set(s.employee_name, s.role);
  }

  const weekGridRows: WeekGridRow[] = nameOrder.map((employeeName) => ({
    employeeName,
    role: roleByName.get(employeeName)!,
    cells: weekDates.map(
      (d) =>
        (weekShifts ?? []).find(
          (s) => s.employee_name === employeeName && s.date === d
        ) ?? null
    ),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">스케줄러</h1>
      </div>

      {(todayShifts?.length ?? 0) > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">오늘의 스케줄</p>
          <ScheduleDayTimeline shifts={todayShifts ?? []} />
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">주간 스케줄</p>
        <ScheduleWeekGrid
          weekStart={weekStart}
          weekDates={weekDates}
          rows={weekGridRows}
          todayDate={today}
          readOnly={isEmployee}
        />
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
