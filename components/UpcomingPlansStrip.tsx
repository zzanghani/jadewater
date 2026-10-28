import Link from "next/link";
import { kstDateString, kstShortDateLabel, kstWeekdayShortLabel, shiftDateString } from "@/lib/date";
import { departmentColor } from "@/lib/departmentColors";
import type { HqProfile } from "@/lib/monthlyPlans";
import type { MonthlyPlan } from "@/lib/types";

const MAX_ROWS = 5;

// 홈 맨 위 "이번 주 일정" 띠. 오늘부터 7일 안에 걸리는 일정만 최대 5줄 보여주고,
// 누르면 월간계획 전체 화면(/plan)으로 간다. 달력 전체를 홈에 두면 스크롤이 너무 길어져서 뺐다.
export default function UpcomingPlansStrip({ plans, hqProfiles }: { plans: MonthlyPlan[]; hqProfiles: HqProfile[] }) {
  const today = kstDateString(0);
  const tomorrow = shiftDateString(today, 1);
  const until = shiftDateString(today, 7);
  const byUser = new Map(hqProfiles.map((p) => [p.id, p]));

  const list = plans
    .filter((p) => p.end_date >= today && p.start_date <= until)
    .sort((a, b) => {
      // 진행 중(이미 시작) → 오늘 → 가까운 날 순. 같은 날이면 시간 빠른 순, 시간 없는 건 뒤로.
      const sa = a.start_date < today ? today : a.start_date;
      const sb = b.start_date < today ? today : b.start_date;
      if (sa !== sb) return sa < sb ? -1 : 1;
      return (a.start_time ?? "99") < (b.start_time ?? "99") ? -1 : 1;
    });
  const shown = list.slice(0, MAX_ROWS);

  const dayLabel = (d: string) => (d === today ? "오늘" : d === tomorrow ? "내일" : `${kstShortDateLabel(d)}(${kstWeekdayShortLabel(d)})`);

  return (
    <Link href="/plan" className="block rounded-2xl border border-border bg-card p-4 transition-colors active:bg-background">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">이번 주 일정</h2>
        <span className="text-xs font-semibold text-brand">월간계획 전체 →</span>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">앞으로 7일 동안 잡힌 일정이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {shown.map((p) => {
            const owner = byUser.get(p.created_by);
            const ongoing = p.start_date < today;
            const isToday = ongoing || p.start_date === today;
            const when = ongoing
              ? `진행 중 ~${kstShortDateLabel(p.end_date)}`
              : `${dayLabel(p.start_date)}${p.start_time ? ` ${p.start_time.slice(0, 5)}` : ""}${p.end_date !== p.start_date ? ` ~${kstShortDateLabel(p.end_date)}` : ""}`;
            return (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  style={{ backgroundColor: departmentColor(owner?.department) }}
                >
                  {owner?.name ?? "본사"}
                </span>
                <span className={`shrink-0 text-xs tabular-nums ${isToday ? "font-semibold text-brand" : "text-muted"}`}>{when}</span>
                <span className="flex-1 truncate text-foreground">{p.title}</span>
                {p.plan_type === "vacation" && (
                  <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted">휴가</span>
                )}
              </div>
            );
          })}
          {list.length > MAX_ROWS && <p className="text-xs text-muted">외 {list.length - MAX_ROWS}건 · 월간계획에서 보기</p>}
        </div>
      )}
    </Link>
  );
}
