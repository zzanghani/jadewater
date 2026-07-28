import { kstDateString, kstDateLabel, shiftDateString } from "@/lib/date";
import type { MonthlyPlan } from "@/lib/types";

// 별도 입력 없이, 아래 달력에 있는 일정들 중 "오늘 마감"과 "D-3(3일 뒤 시작)"만
// 자동으로 뽑아 보여주는 전광판 — 직접 체크하는 할 일 목록이 아니다.
export default function MonthlyPlanAlerts({ plans }: { plans: MonthlyPlan[] }) {
  const today = kstDateString(0);
  const dDay3Date = shiftDateString(today, 3);

  const dueToday = plans.filter((p) => p.start_date <= today && today <= p.end_date);
  const upcoming = plans.filter((p) => p.start_date === dDay3Date);

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
          <p className="mb-1.5 text-xs font-semibold text-orange-600">⏰ D-3 (3일 뒤 시작)</p>
          <div className="flex flex-col gap-1">
            {upcoming.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="flex-1 truncate text-foreground">{p.title}</span>
                <span className="shrink-0 text-xs text-muted">{kstDateLabel(p.start_date)} 시작</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
