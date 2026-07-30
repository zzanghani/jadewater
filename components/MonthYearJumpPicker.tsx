"use client";

import { useState } from "react";

// 달력 상단의 "2024년 9월" 같은 라벨을 눌러서, 화살표로 한 달씩 넘기지 않고
// 연도(10년 단위)와 월(4x3)을 바로 골라 몇 년 전 달로도 한 번에 이동한다.
export default function MonthYearJumpPicker({
  month, // 'YYYY-MM'
  label,
  onChange,
}: {
  month: string;
  label: string;
  onChange: (month: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentYear = Number(month.slice(0, 4));
  const currentMonthNum = Number(month.slice(5, 7));
  const [year, setYear] = useState(currentYear);
  const [decadeStart, setDecadeStart] = useState(Math.floor(currentYear / 10) * 10);

  function openPicker() {
    setYear(currentYear);
    setDecadeStart(Math.floor(currentYear / 10) * 10);
    setOpen(true);
  }

  function pickMonth(m: number) {
    onChange(`${year}-${String(m).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold transition-colors hover:bg-background"
      >
        {label}
        <span aria-hidden className="text-xs text-muted">▾</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-card p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDecadeStart((d) => d - 10)}
                aria-label="이전 10년"
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:text-foreground"
              >
                ←
              </button>
              <span className="text-xs font-semibold text-muted">
                {decadeStart}년 - {decadeStart + 9}년
              </span>
              <button
                type="button"
                onClick={() => setDecadeStart((d) => d + 10)}
                aria-label="다음 10년"
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:text-foreground"
              >
                →
              </button>
            </div>

            <div className="mb-4 grid grid-cols-5 gap-1.5">
              {Array.from({ length: 10 }, (_, i) => decadeStart + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                    y === year
                      ? "bg-brand text-white"
                      : "text-foreground hover:bg-background"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            <div className="mb-1 text-xs font-semibold text-muted">{year}년</div>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const isSelected = year === currentYear && m === currentMonthNum;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickMonth(m)}
                    className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                      isSelected
                        ? "bg-brand text-white"
                        : "text-foreground hover:bg-background"
                    }`}
                  >
                    {m}월
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
