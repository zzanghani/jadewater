"use client";

import { useState } from "react";
import {
  daysInMonthKST,
  kstDateString,
  kstWeekday,
  monthRangeFromMonthString,
  shiftMonthString,
} from "@/lib/date";

const WEEKDAY_HEADER = ["일", "월", "화", "수", "목", "금", "토"];

export default function ScheduleMultiDatePicker({
  initialDate,
  dates,
  onChange,
}: {
  initialDate: string;
  dates: string[];
  onChange: (dates: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(initialDate.slice(0, 7));

  const range = monthRangeFromMonthString(month);
  const days = daysInMonthKST(range.start);
  const firstWeekday = kstWeekday(days[0]);
  const leadingBlanks = Array.from({ length: firstWeekday }, () => null);
  const cells = [...leadingBlanks, ...days];
  const trailingCount = (7 - (cells.length % 7)) % 7;
  const allCells = [...cells, ...Array.from({ length: trailingCount }, () => null)];

  const today = kstDateString(0);
  const selectedSet = new Set(dates);
  const sortedDates = [...dates].sort();

  function toggleDate(d: string) {
    if (selectedSet.has(d)) {
      // 마지막 남은 날짜는 탭 한 번으로 사라지지 않게 막는다.
      // (0일 선택 상태가 되면 어떤 날짜가 원래 선택돼 있었는지 화면에서
      // 전혀 알 수 없게 되어버리는 문제가 있었다. 완전히 비우려면
      // "전체 해제" 버튼을 쓰도록 유도한다.)
      if (dates.length === 1) return;
      onChange(dates.filter((x) => x !== d));
    } else {
      onChange([...dates, d]);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      날짜
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-2.5 text-left text-sm outline-none ring-brand/30 focus:ring-2"
      >
        <span>
          {sortedDates.length === 0
            ? "날짜를 선택하세요"
            : sortedDates.length === 1
            ? sortedDates[0]
            : `${sortedDates.length}일 선택됨 (${sortedDates[0]} 외)`}
        </span>
        <span aria-hidden>📅</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-card p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMonth((m) => shiftMonthString(m, -1))}
                aria-label="이전달"
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:text-foreground"
              >
                ←
              </button>
              <span className="text-sm font-bold">{range.label}</span>
              <button
                type="button"
                onClick={() => setMonth((m) => shiftMonthString(m, 1))}
                aria-label="다음달"
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:text-foreground"
              >
                →
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
              {WEEKDAY_HEADER.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {allCells.map((d, idx) => {
                if (!d) return <div key={`blank-${idx}`} />;
                const isSelected = selectedSet.has(d);
                const isToday = d === today;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDate(d)}
                    className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                      isSelected
                        ? "bg-brand text-white"
                        : isToday
                        ? "bg-brand-light text-brand"
                        : "text-foreground hover:bg-background"
                    }`}
                  >
                    {Number(d.slice(-2))}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="text-xs text-muted">{dates.length}일 선택됨</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted"
                >
                  전체 해제
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
