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

// 시작일을 고르면 팝업이 안 닫히고 바로 이어서 종료일을 고를 수 있는
// 달력 하나짜리 기간 선택기. 시작일/종료일을 각각 따로 열어야 했던
// 번거로움을 없애기 위한 것.
export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((startDate || kstDateString(0)).slice(0, 7));
  const [draftStart, setDraftStart] = useState(startDate);
  const [pickingEnd, setPickingEnd] = useState(false);

  const range = monthRangeFromMonthString(month);
  const days = daysInMonthKST(range.start);
  const firstWeekday = kstWeekday(days[0]);
  const leadingBlanks = Array.from({ length: firstWeekday }, () => null);
  const cells = [...leadingBlanks, ...days];
  const trailingCount = (7 - (cells.length % 7)) % 7;
  const allCells = [...cells, ...Array.from({ length: trailingCount }, () => null)];

  const today = kstDateString(0);

  function openPicker() {
    setDraftStart(startDate);
    setPickingEnd(false);
    setMonth((startDate || kstDateString(0)).slice(0, 7));
    setOpen(true);
  }

  function pickDay(d: string) {
    if (!pickingEnd) {
      setDraftStart(d);
      setPickingEnd(true);
      return;
    }
    const start = d < draftStart ? d : draftStart;
    const end = d < draftStart ? draftStart : d;
    onChange(start, end);
    setPickingEnd(false);
    setOpen(false);
  }

  function pickSingleDay() {
    onChange(draftStart, draftStart);
    setPickingEnd(false);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      기간
      <button
        type="button"
        onClick={openPicker}
        className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-2.5 text-left text-sm outline-none ring-brand/30 focus:ring-2"
      >
        <span>{startDate === endDate ? startDate : `${startDate} ~ ${endDate}`}</span>
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
            <div className="mb-2 text-center text-xs font-semibold text-brand">
              {pickingEnd ? `종료일을 선택하세요 (시작일 ${draftStart})` : "시작일을 선택하세요"}
            </div>
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
                const isStart = pickingEnd && d === draftStart;
                const isToday = d === today;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => pickDay(d)}
                    className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                      isStart
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

            {pickingEnd && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={pickSingleDay}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted"
                >
                  하루만
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
