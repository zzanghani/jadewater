import { kstDateString, kstDateLabel, shiftDateString } from "@/lib/date";
import type { MonthlyPlan } from "@/lib/types";

// 별도 입력 없이, 아래 달력에 있는 일정들 중 "오늘 진행 중"과 "마감 3일 전부터"만
// 자동으로 뽑아 보여주는 전광판 — 직접 체크하는 할 일 목록이 아니다.
// 휴가는 확인이 필요한 업무가 아니므로 알림판 대상에서 제외한다.
export default function MonthlyPlanAlerts({ plans }: { plans: MonthlyPlan[] }) {
  const today = kstDateString(0);
  const taskPlans = plans.filter((p) => p.plan_type !== "vacation");

  const dueToday = taskPlans.filter((p) => p.start_date <= today && today <= p.end_date);
  const upcoming = taskPlans.filter((p) => shiftDateString(p.end_date, -3) <= today && today <= p.end_date);

  if (dueToday.length === 0 && upcoming.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted">오늘 확인할 일정이 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      {dueToday.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-brand">🔴 오늘 진행 중</p>
          <div className="flex flex-col gap-1">
            {dueToday.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="flex-1 truncate text-foreground">{p.title}</span>
                <span className="shrink-0 text-xs text-muted">
                  {p.end_date === today ? "오늘 마감" : `~${kstDateLabel(p.end_date)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className={dueToday.length > 0 ? "border-t border-border pt-3" : ""}>
          <p className="mb-1.5 text-xs font-semibold text-orange-600">⏰ 마감 임박 — 업무 확인</p>
          <div className="flex flex-col gap-1">
            {upcoming.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="flex-1 truncate text-foreground">{p.title}</span>
                <span className="shrink-0 text-xs text-muted">
                  {p.end_date === today ? "오늘 마감" : `${kstDateLabel(p.end_date)} 마감`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
