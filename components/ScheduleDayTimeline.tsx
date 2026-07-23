import { roleColor } from "@/lib/scheduleColors";
import type { ScheduleShift } from "@/lib/types";

const HOUR_MARKS = [0, 6, 12, 18, 24];

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function ScheduleDayTimeline({ shifts }: { shifts: ScheduleShift[] }) {
  if (shifts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">근무 시간표</h2>
      <div className="mb-1.5 flex justify-between pl-16 text-[10px] text-muted">
        {HOUR_MARKS.map((h) => (
          <span key={h}>{h}시</span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {shifts.map((s) => {
          const start = toMinutes(s.start_time);
          const rawEnd = toMinutes(s.end_time);
          const end = rawEnd <= start ? 1440 : rawEnd;
          const left = (start / 1440) * 100;
          const width = Math.max(((end - start) / 1440) * 100, 2);
          return (
            <div key={s.id} className="flex items-center gap-2">
              <span className="w-14 shrink-0 truncate text-[11px] font-medium text-foreground">
                {s.employee_name}
              </span>
              <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-background">
                <div
                  className="absolute inset-y-0 rounded-md"
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: roleColor(s.role) }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
