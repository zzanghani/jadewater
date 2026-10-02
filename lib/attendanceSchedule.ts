// 출퇴근 기록과 스케줄러(schedule_shifts)를 맞춰 보는 로직.
// 스케줄은 employee_name(글자)로만 사람을 구분하므로 이름을 공백 없이 비교한다.

import type { AttendanceType } from "@/lib/types";

export type ShiftLike = {
  id: string;
  date: string;
  employee_name: string;
  start_time: string; // "08:00:00"
  end_time: string;
};

export function normalizeName(name: string | null | undefined): string {
  return (name ?? "").replace(/\s+/g, "").trim();
}

// "08:30:00" → 510 (자정 기준 분)
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

// ISO 시각 → KST 날짜('YYYY-MM-DD')와 자정 기준 분
export function kstDateAndMinutes(iso: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = Number(get("hour")) % 24; // 일부 런타임은 자정을 "24"로 준다
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + Number(get("minute")),
  };
}

// KST 날짜 + "HH:MM:SS" → ISO(UTC)
export function kstDateTimeToIso(date: string, time: string): string {
  return new Date(`${date}T${time.slice(0, 8).padEnd(8, "0")}+09:00`).toISOString();
}

/**
 * 그날 같은 이름의 근무 중 가장 가까운 것을 고른다.
 * 출근은 시작 시각, 퇴근은 종료 시각 기준. 하루 두 타임 근무면 가까운 쪽.
 */
export function matchShift(
  shifts: ShiftLike[],
  names: string[],
  type: AttendanceType,
  recordedMinutes: number
): { shift: ShiftLike; scheduledMinutes: number; diffMinutes: number } | null {
  const wanted = new Set(names.map(normalizeName).filter(Boolean));
  if (wanted.size === 0) return null;
  let best: { shift: ShiftLike; scheduledMinutes: number; diffMinutes: number } | null = null;
  for (const s of shifts) {
    if (!wanted.has(normalizeName(s.employee_name))) continue;
    const scheduled = timeToMinutes(type === "IN" ? s.start_time : s.end_time);
    const diff = recordedMinutes - scheduled;
    if (!best || Math.abs(diff) < Math.abs(best.diffMinutes)) {
      best = { shift: s, scheduledMinutes: scheduled, diffMinutes: diff };
    }
  }
  return best;
}

export type ScheduleVerdict =
  | { kind: "late"; minutes: number }
  | { kind: "early_leave"; minutes: number }
  | { kind: "on_time" }
  | { kind: "none" };

// 기록 한 건을 "10분 지각 / 정시 / 20분 조퇴" 중 하나로.
export function scheduleVerdict(type: AttendanceType, diffMinutes: number | null): ScheduleVerdict {
  if (diffMinutes === null || diffMinutes === undefined) return { kind: "none" };
  if (type === "IN") {
    return diffMinutes > 0 ? { kind: "late", minutes: diffMinutes } : { kind: "on_time" };
  }
  return diffMinutes < 0 ? { kind: "early_leave", minutes: -diffMinutes } : { kind: "on_time" };
}

// 60분 넘으면 "1시간 20분"처럼 읽기 쉽게.
function minutesLabel(m: number): string {
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${m}분`;
  return rest === 0 ? `${h}시간` : `${h}시간 ${rest}분`;
}

export function verdictLabel(v: ScheduleVerdict): string {
  switch (v.kind) {
    case "late":
      return `${minutesLabel(v.minutes)} 지각`;
    case "early_leave":
      return `${minutesLabel(v.minutes)} 조퇴`;
    case "on_time":
      return "정시";
    default:
      return "";
  }
}
