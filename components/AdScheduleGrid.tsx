"use client";

// 요일×시간 노출 격자. 칸을 누르면 켜고 끄고, 드래그 없이 단순 탭 방식(폰 기준).
// schedule: 요일(0=일 … 6=토) → 켜진 시간 목록(0~23).
export type WeekSchedule = Record<number, number[]>;
export const DAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function allOn(): WeekSchedule {
  const out: WeekSchedule = {};
  for (let d = 0; d < 7; d++) out[d] = Array.from({ length: 24 }, (_, h) => h);
  return out;
}
export function hoursOnly(hours: number[]): WeekSchedule {
  const out: WeekSchedule = {};
  for (let d = 0; d < 7; d++) out[d] = [...hours].sort((a, b) => a - b);
  return out;
}
export function scheduleEquals(a: WeekSchedule, b: WeekSchedule): boolean {
  for (let d = 0; d < 7; d++) {
    const x = [...(a[d] ?? [])].sort((p, q) => p - q).join(",");
    const y = [...(b[d] ?? [])].sort((p, q) => p - q).join(",");
    if (x !== y) return false;
  }
  return true;
}
export function scheduleSummary(s: WeekSchedule): string {
  const total = Object.values(s).reduce((n, hs) => n + hs.length, 0);
  if (total === 168) return "항상 노출";
  if (total === 0) return "노출 없음";
  // 모든 요일이 같으면 시간대만 요약
  const first = [...(s[0] ?? [])].sort((a, b) => a - b).join(",");
  const same = DAY_ORDER.every((d) => [...(s[d] ?? [])].sort((a, b) => a - b).join(",") === first);
  const rng = (hs: number[]) => {
    const sorted = [...hs].sort((a, b) => a - b);
    const parts: string[] = [];
    let st = sorted[0];
    let prev = sorted[0];
    for (const h of sorted.slice(1)) {
      if (h === prev + 1) {
        prev = h;
        continue;
      }
      parts.push(`${st}~${prev + 1}시`);
      st = h;
      prev = h;
    }
    if (st != null) parts.push(`${st}~${prev + 1}시`);
    return parts.join(", ");
  };
  if (same) return `매일 ${rng(s[0] ?? [])}`;
  return `${DAY_ORDER.map((d) => `${DAY_LABEL[d]} ${s[d]?.length ? rng(s[d]) : "꺼짐"}`).join(" · ")}`;
}

export default function AdScheduleGrid({ value, onChange, hours = Array.from({ length: 24 }, (_, h) => h) }: { value: WeekSchedule; onChange: (v: WeekSchedule) => void; hours?: number[] }) {
  const toggle = (d: number, h: number) => {
    const set = new Set(value[d] ?? []);
    if (set.has(h)) set.delete(h);
    else set.add(h);
    onChange({ ...value, [d]: [...set].sort((a, b) => a - b) });
  };
  const toggleDay = (d: number) => {
    const on = (value[d] ?? []).length >= hours.length;
    onChange({ ...value, [d]: on ? [] : [...hours] });
  };
  const toggleHour = (h: number) => {
    const allOnH = DAY_ORDER.every((d) => (value[d] ?? []).includes(h));
    const next: WeekSchedule = { ...value };
    for (const d of DAY_ORDER) {
      const set = new Set(next[d] ?? []);
      if (allOnH) set.delete(h);
      else set.add(h);
      next[d] = [...set].sort((a, b) => a - b);
    }
    onChange(next);
  };
  return (
    <div className="grid gap-[2px]" style={{ gridTemplateColumns: `30px repeat(${hours.length}, minmax(0, 1fr))` }}>
      <div />
      {hours.map((h) => (
        <button key={h} type="button" onClick={() => toggleHour(h)} className="text-center text-[10px] text-muted">
          {h}
        </button>
      ))}
      {DAY_ORDER.map((d) => (
        <RowCells key={d} d={d} hours={hours} on={new Set(value[d] ?? [])} toggle={toggle} toggleDay={toggleDay} />
      ))}
    </div>
  );
}

function RowCells({ d, hours, on, toggle, toggleDay }: { d: number; hours: number[]; on: Set<number>; toggle: (d: number, h: number) => void; toggleDay: (d: number) => void }) {
  return (
    <>
      <button type="button" onClick={() => toggleDay(d)} className={`text-left text-[11px] font-semibold ${d === 0 ? "text-red-600" : d === 6 ? "text-blue-700" : ""}`}>
        {DAY_LABEL[d]}
      </button>
      {hours.map((h) => (
        <button key={h} type="button" onClick={() => toggle(d, h)} aria-label={`${DAY_LABEL[d]} ${h}시`} className={`h-6 rounded-[3px] ${on.has(h) ? "bg-brand" : "bg-border/60"}`} />
      ))}
    </>
  );
}
