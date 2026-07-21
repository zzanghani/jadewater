"use client";

import { useState } from "react";
import Link from "next/link";
import { formatWon } from "@/lib/format";
import { kstDateLabel, kstWeekday } from "@/lib/date";
import type { DailyClosing } from "@/lib/types";

const WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];

function compactWon(value: number): string {
  if (value >= 10000) return `${Math.round(value / 10000)}만`;
  return value.toLocaleString();
}

export default function ClosingCalendar({
  days,
  recordsByDate,
  editable,
  accentColor = "var(--brand)",
  todayDate,
}: {
  days: string[];
  recordsByDate: Record<string, DailyClosing>;
  editable: boolean;
  accentColor?: string;
  todayDate?: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const leadingBlanks = days.length ? kstWeekday(days[0]) : 0;
  const selected = selectedDate ? recordsByDate[selectedDate] : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-medium text-muted">
          {WEEKDAY_HEADERS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {days.map((date) => {
            const record = recordsByDate[date];
            const hasData = Boolean(record);
            const dayNum = Number(date.slice(8, 10));
            const isToday = date === todayDate;
            const isSelected = date === selectedDate;

            const cell = (
              <div
                className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border text-center ${
                  isSelected
                    ? "border-foreground"
                    : isToday
                    ? "border-brand"
                    : "border-transparent"
                }`}
                style={
                  hasData
                    ? { backgroundColor: accentColor, color: "#fff" }
                    : { color: "var(--muted)" }
                }
              >
                <span className="text-[11px] font-semibold">{dayNum}</span>
                <span className="text-[10px] font-medium leading-tight">
                  {hasData ? compactWon(record.grand_total) : "-"}
                </span>
              </div>
            );

            if (editable) {
              return (
                <Link key={date} href={`/closing?date=${date}`}>
                  {cell}
                </Link>
              );
            }

            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(isSelected ? null : date)}
                className="appearance-none"
              >
                {cell}
              </button>
            );
          })}
        </div>
      </div>

      {!editable && selectedDate && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">{kstDateLabel(selectedDate)} 마감보고</h3>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-xs font-medium text-muted"
            >
              닫기
            </button>
          </div>
          {!selected ? (
            <p className="text-sm text-muted">등록된 마감 내역이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">총매출</span>
                <span className="text-base font-bold text-brand">
                  {formatWon(selected.grand_total)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted">
                <span>런치 {selected.lunch_guests.toLocaleString()}명</span>
                <span>디너 {selected.dinner_guests.toLocaleString()}명</span>
                <span>카드 {formatWon(selected.card_sales)}</span>
                <span>현금 {formatWon(selected.cash_sales)}</span>
                <span>간편결제 {formatWon(selected.easypay_sales)}</span>
                <span>할인 {formatWon(selected.discount_amount)}</span>
                <span>음식 {formatWon(selected.food_sales)}</span>
                <span>음료 {formatWon(selected.beverage_sales)}</span>
                <span>와인 {formatWon(selected.wine_sales)}</span>
                <span>대관 {formatWon(selected.rental_sales)}</span>
                <span>쿠팡이츠 {formatWon(selected.coupang_eats_sales)}</span>
                <span>배달의민족 {formatWon(selected.baemin_sales)}</span>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-foreground">특이사항</p>
                <p className="text-xs text-muted">{selected.notes || "특이사항 없음"}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
