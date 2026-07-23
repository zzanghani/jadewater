import { roleColor } from "@/lib/scheduleColors";
import type { ScheduleShift } from "@/lib/types";

const RANGE_START = 9 * 60; // 09:00
const RANGE_END = 21 * 60; // 21:00
const RANGE_SPAN = RANGE_END - RANGE_START;
const HOUR_MARKS = Array.from({ length: 13 }, (_, i) => 9 + i); // 9~21시, 1시간 단위

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function ScheduleDayTimeline({ shifts }: { shifts: ScheduleShift[] }) {
  if (shifts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">근무 시간표</h2>
      <div className="mb-1.5 flex justify-between pl-16 text-[9px] text-muted">
        {HOUR_MARKS.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {shifts.map((s) => {
          const rawStart = toMinutes(s.start_time);
          const rawEndRaw = toMinutes(s.end_time);
          const rawEnd = rawEndRaw <= rawStart ? rawEndRaw + 24 * 60 : rawEndRaw;
          const start = Math.min(Math.max(rawStart, RANGE_START), RANGE_END);
          const end = Math.min(Math.max(rawEnd, RANGE_START), RANGE_END);
          const left = ((start - RANGE_START) / RANGE_SPAN) * 100;
          const width = Math.max(((end - start) / RANGE_SPAN) * 100, 2);
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
