"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteEmployeeShifts } from "@/app/(app)/schedule/actions";
import { SCHEDULE_ROLES, roleColor } from "@/lib/scheduleColors";
import { kstWeekdayShortLabel, mondayWeekRangeLabel, shiftDateString } from "@/lib/date";
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
  readOnly = false,
}: {
  weekStart: string;
  weekDates: string[];
  rows: WeekGridRow[];
  todayDate: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<{
    employeeName: string;
    role: ScheduleRole;
    date: string;
    shift: ScheduleShift | null;
  } | null>(null);

  const existingNames = new Set(rows.map((r) => r.employeeName));
  const pendingRows: WeekGridRow[] = extraNames
    .filter((n) => !existingNames.has(n))
    .map((name) => ({ employeeName: name, role: "사원", cells: Array(7).fill(null) }));
  const displayRows = [...rows, ...pendingRows].sort((a, b) => {
    const roleDiff = SCHEDULE_ROLES.indexOf(a.role) - SCHEDULE_ROLES.indexOf(b.role);
    return roleDiff !== 0 ? roleDiff : a.employeeName.localeCompare(b.employeeName, "ko");
  });

  function addRow() {
    const name = newName.trim();
    if (!name) return;
    if (!existingNames.has(name) && !extraNames.includes(name)) {
      setExtraNames((prev) => [...prev, name]);
    }
    setNewName("");
  }

  function deleteRow(row: WeekGridRow) {
    const isPending = !existingNames.has(row.employeeName);
    if (
      !window.confirm(
        `${row.employeeName} 님을 명단에서 삭제할까요?${
          isPending ? "" : " 등록된 근무 기록도 모두 삭제됩니다."
        }`
      )
    )
      return;
    if (isPending) {
      setExtraNames((prev) => prev.filter((n) => n !== row.employeeName));
      return;
    }
    const formData = new FormData();
    formData.set("employee_name", row.employeeName);
    deleteEmployeeShifts(formData).then(() => router.refresh());
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
        <span className="text-sm font-bold">{mondayWeekRangeLabel(weekStart)}</span>
        <Link
          href={`/schedule?week=${shiftDateString(weekStart, 7)}`}
          aria-label="다음주"
          className="rounded-xl px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-foreground"
        >
          →
        </Link>
      </div>

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
                      isSun
                        ? "text-red-500"
                        : isToday
                        ? "text-brand"
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
              displayRows.map((row) => {
                const canDeleteRow = !readOnly;
                return (
                <tr key={row.employeeName} className="border-t border-border">
                  <td className="sticky left-0 z-10 bg-card px-2 py-2 text-left font-semibold text-foreground">
                    <div className="flex items-center gap-1">
                      <span
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: roleColor(row.role) }}
                      />
                      <span className="truncate">{row.employeeName}</span>
                      {canDeleteRow && (
                        <button
                          type="button"
                          onClick={() => deleteRow(row)}
                          aria-label={`${row.employeeName} 삭제`}
                          className="ml-0.5 shrink-0 text-[11px] text-muted hover:text-red-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </td>
                  {weekDates.map((d, i) => {
                    const cellShift = row.cells[i];
                    const canOpen = !readOnly;
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
                              : "text-orange-500"
                          } ${canOpen ? "hover:opacity-70" : "opacity-60"}`}
                        >
                          {cellShift ? cellShift.start_time.slice(0, 5) : "OFF"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
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
      )}

      {!readOnly && selected && (
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
