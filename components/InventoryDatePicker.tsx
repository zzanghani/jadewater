"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  daysInMonthKST,
  kstDateString,
  kstWeekday,
  monthRangeFromMonthString,
  shiftMonthString,
} from "@/lib/date";
import type { InventorySection } from "@/lib/types";

const WEEKDAY_HEADER = ["일", "월", "화", "수", "목", "금", "토"];

export default function InventoryDatePicker({
  section,
  date,
}: {
  section: InventorySection;
  date: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(date.slice(0, 7));

  const range = monthRangeFromMonthString(month);
  const days = daysInMonthKST(range.start);
  const firstWeekday = kstWeekday(days[0]);
  const leadingBlanks = Array.from({ length: firstWeekday }, () => null);
  const cells = [...leadingBlanks, ...days];
  const trailingCount = (7 - (cells.length % 7)) % 7;
  const allCells = [...cells, ...Array.from({ length: trailingCount }, () => null)];

  const today = kstDateString(0);

  function pickDate(d: string) {
    setOpen(false);
    router.push(`/inventory?section=${encodeURIComponent(section)}&date=${d}`);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setMonth(date.slice(0, 7));
          setOpen(true);
        }}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
      >
        <span aria-hidden>📅</span> {date}
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
          </div>
        </div>
      )}
    </div>
  );
}
