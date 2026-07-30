"use client";

import { useState } from "react";
import {
  daysInMonthKST,
  kstDateString,
  kstWeekday,
  monthRangeFromMonthString,
  shiftMonthString,
} from "@/lib/date";
import MonthYearJumpPicker from "@/components/MonthYearJumpPicker";

const WEEKDAY_HEADER = ["일", "월", "화", "수", "목", "금", "토"];

// 스케줄러(ScheduleMultiDatePicker)/재고관리(InventoryDatePicker)와 같은
// 팝업 달력 UX를, 폼 필드에서 날짜 하나만 고르는 용도로 재사용하기 위한 버전.
export default function SingleDatePicker({
  label,
  date,
  onChange,
  allowClear = false,
  placeholder = "날짜를 선택하세요",
}: {
  label: string;
  date: string;
  onChange: (date: string) => void;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((date || kstDateString(0)).slice(0, 7));

  const range = monthRangeFromMonthString(month);
  const days = daysInMonthKST(range.start);
  const firstWeekday = kstWeekday(days[0]);
  const leadingBlanks = Array.from({ length: firstWeekday }, () => null);
  const cells = [...leadingBlanks, ...days];
  const trailingCount = (7 - (cells.length % 7)) % 7;
  const allCells = [...cells, ...Array.from({ length: trailingCount }, () => null)];

  const today = kstDateString(0);

  function pickDate(d: string) {
    onChange(d);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <button
        type="button"
        onClick={() => {
          setMonth((date || kstDateString(0)).slice(0, 7));
          setOpen(true);
        }}
        className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-2.5 text-left text-sm outline-none ring-brand/30 focus:ring-2"
      >
        <span className={date ? "" : "text-muted"}>{date || placeholder}</span>
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
              <MonthYearJumpPicker month={month} label={range.label} onChange={setMonth} />
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
                const isSelected = d === date;
                const isToday = d === today;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => pickDate(d)}
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

            {allowClear && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted"
                >
                  선택 안 함
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
