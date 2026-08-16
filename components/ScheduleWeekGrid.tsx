"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { unlockScheduleAdmin } from "@/app/(app)/schedule/actions";
import { roleColor } from "@/lib/scheduleColors";
import { kstWeekdayShortLabel, shiftDateString, sundayWeekRangeLabel } from "@/lib/date";
import ScheduleCellForm from "@/components/ScheduleCellForm";
import type { ScheduleRole, ScheduleShift } from "@/lib/types";

export type WeekGridRow = {
  employeeName: string;
  role: ScheduleRole;
  cells: (ScheduleShift | null)[]; // weekDates와 같은 순서(일~토), 근무 없으면 null
};

export default function ScheduleWeekGrid({
  weekStart,
  weekDates,
  rows,
  todayDate,
}: {
  weekStart: string;
  weekDates: string[];
  rows: WeekGridRow[];
  todayDate: string;
}) {
  const [unlockState, unlockAction, unlockPending] = useActionState(
    unlockScheduleAdmin,
    undefined
  );
  const [unlocked, setUnlocked] = useState(false);
  const [showUnlockForm, setShowUnlockForm] = useState(false);
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<{
    employeeName: string;
    role: ScheduleRole;
    date: string;
    shift: ScheduleShift | null;
  } | null>(null);

  useEffect(() => {
    if (unlockState?.success) {
      setUnlocked(true);
      setShowUnlockForm(false);
    }
  }, [unlockState]);

  const existingNames = new Set(rows.map((r) => r.employeeName));
  const pendingRows: WeekGridRow[] = extraNames
    .filter((n) => !existingNames.has(n))
    .map((name) => ({ employeeName: name, role: "사원", cells: Array(7).fill(null) }));
  const displayRows = [...rows, ...pendingRows];

  function addRow() {
    const name = newName.trim();
    if (!name) return;
    if (!existingNames.has(name) && !extraNames.includes(name)) {
      setExtraNames((prev) => [...prev, name]);
    }
    setNewName("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between rounded-2xl bg-card p-1.5">
        <Link
          href={`/schedule?week=${shiftDateString(weekStart, -7)}`}
          aria-label="이전주"
          className="rounded-xl px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-foreground"
        >
          ←
        </Link>
        <span className="text-sm font-bold">{sundayWeekRangeLabel(weekStart)}</span>
        <Link
          href={`/schedule?week=${shiftDateString(weekStart, 7)}`}
          aria-label="다음주"
          className="rounded-xl px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-foreground"
        >
          →
        </Link>
      </div>

      <div className="flex justify-end">
        {unlocked ? (
          <span className="text-[11px] font-medium text-muted">🔓 기존 근무 수정·삭제 가능</span>
        ) : (
          <button
            type="button"
            onClick={() => setShowUnlockForm((v) => !v)}
            className="text-[11px] font-medium text-muted underline-offset-2 hover:underline"
          >
            🔒 기존 근무 수정·삭제 잠금 해제
          </button>
        )}
      </div>
      {showUnlockForm && !unlocked && (
        <form
          action={unlockAction}
          className="flex gap-2 rounded-xl border border-border bg-card p-2"
        >
          <input
            type="password"
            name="password"
            required
            autoFocus
            placeholder="비밀번호"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-brand/30 focus:ring-2"
          />
          <button
            type="submit"
            disabled={unlockPending}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            확인
          </button>
        </form>
      )}
      {showUnlockForm && !unlocked && unlockState?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {unlockState.error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card px-2 py-2 text-left text-[11px] font-semibold text-muted">
                이름
              </th>
              {weekDates.map((d) => {
                const isToday = d === todayDate;
                const weekday = kstWeekdayShortLabel(d);
                const isSun = weekday === "일";
                const isSat = weekday === "토";
                return (
                  <th
                    key={d}
                    className={`px-1.5 py-2 text-center text-[11px] font-semibold ${
                      isToday
                        ? "text-brand"
                        : isSun
                        ? "text-red-500"
                        : isSat
                        ? "text-blue-500"
                        : "text-muted"
                    }`}
                  >
                    <div>{weekday}</div>
                    <div>{Number(d.slice(-2))}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted">
                  아직 등록된 근무자가 없습니다.
                </td>
              </tr>
            ) : (
              displayRows.map((row) => (
                <tr key={row.employeeName} className="border-t border-border">
                  <td className="sticky left-0 z-10 bg-card px-2 py-2 text-left font-semibold text-foreground">
                    <span
                      className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: roleColor(row.role) }}
                    />
                    {row.employeeName}
                  </td>
                  {weekDates.map((d, i) => {
                    const cellShift = row.cells[i];
                    // 빈 칸(새 근무 추가)은 잠금과 무관하게 항상 열 수 있고,
                    // 이미 등록된 근무를 고치거나 지울 때만 잠금 해제가 필요하다.
                    const canOpen = unlocked || !cellShift;
                    return (
                      <td key={d} className="px-1 py-1 text-center">
                        <button
                          type="button"
                          disabled={!canOpen}
                          onClick={() =>
                            canOpen &&
                            setSelected({
                              employeeName: row.employeeName,
                              role: row.role,
                              date: d,
                              shift: cellShift,
                            })
                          }
                          className={`w-full rounded-lg px-1 py-1.5 text-[11px] font-semibold transition-opacity ${
                            cellShift
                              ? "bg-brand-light text-brand-dark"
                              : "text-muted"
                          } ${canOpen ? "hover:opacity-70" : "opacity-60"}`}
                        >
                          {cellShift ? cellShift.start_time.slice(0, 5) : "OFF"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addRow();
            }
          }}
          placeholder="새 직원 이름 추가"
          className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
        <button
          type="button"
          onClick={addRow}
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
        >
          + 추가
        </button>
      </div>

      {selected && (
        <ScheduleCellForm
          date={selected.date}
          employeeName={selected.employeeName}
          defaultRole={selected.role}
          shift={selected.shift}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
