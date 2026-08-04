"use client";

import { useState } from "react";

type Period = "오전" | "오후";

const DEFAULT_MINUTES = [0, 10, 20, 30, 40, 50];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);

function to24h(period: Period, hour12: number, minute: number): string {
  const hour24 = period === "오후" ? (hour12 % 12) + 12 : hour12 % 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// "HH:MM"(24시간제) 문자열을 이 컴포넌트의 defaultPeriod/defaultHour/defaultMinute로 변환.
export function parseTimeTo12h(time: string | null | undefined): {
  period: Period;
  hour: number;
  minute: number;
} {
  if (!time) return { period: "오전", hour: 9, minute: 0 };
  const [h, m] = time.split(":").map(Number);
  const period: Period = h >= 12 ? "오후" : "오전";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { period, hour: hour12, minute: m };
}

export default function AmPmTimeSelect({
  name,
  defaultPeriod = "오전",
  defaultHour = 9,
  defaultMinute = 0,
  minutes = DEFAULT_MINUTES,
}: {
  name: string;
  defaultPeriod?: Period;
  defaultHour?: number;
  defaultMinute?: number;
  minutes?: number[];
}) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [hour, setHour] = useState(defaultHour);
  const [minute, setMinute] = useState(defaultMinute);

  const selectClass =
    "rounded-xl border border-border bg-background px-2 py-2.5 text-sm outline-none ring-brand/30 focus:ring-2";

  return (
    <div className="flex gap-1.5">
      <input type="hidden" name={name} value={to24h(period, hour, minute)} />
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value as Period)}
        className={selectClass}
      >
        <option value="오전">오전</option>
        <option value="오후">오후</option>
      </select>
      <select
        value={hour}
        onChange={(e) => setHour(Number(e.target.value))}
        className={`${selectClass} flex-1`}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}시
          </option>
        ))}
      </select>
      <select
        value={minute}
        onChange={(e) => setMinute(Number(e.target.value))}
        className={`${selectClass} flex-1`}
      >
        {minutes.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}분
          </option>
        ))}
      </select>
    </div>
  );
}
