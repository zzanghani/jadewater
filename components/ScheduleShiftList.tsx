"use client";

import { useState } from "react";
import { roleColor } from "@/lib/scheduleColors";
import DeleteShiftButton from "@/components/DeleteShiftButton";
import ScheduleShiftEditForm from "@/components/ScheduleShiftEditForm";
import type { ScheduleShift } from "@/lib/types";

export default function ScheduleShiftList({
  shifts,
  date,
  readOnly = false,
}: {
  shifts: ScheduleShift[];
  date: string;
  readOnly?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {shifts.length === 0 ? (
        <p className="text-sm text-muted">등록된 근무자가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shifts.map((s) =>
            editingId === s.id ? (
              <li key={s.id}>
                <ScheduleShiftEditForm
                  shift={s}
                  date={date}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: roleColor(s.role) }}
                >
                  {s.role}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{s.employee_name}</p>
                  <p className="text-xs text-muted">
                    {s.start_time.slice(0, 5)} ~ {s.end_time.slice(0, 5)}
                    {s.break_minutes > 0 ? ` · 휴게 ${s.break_minutes}분` : ""}
                    {s.notes ? ` · ${s.notes}` : ""}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(s.id)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-brand"
                    >
                      수정
                    </button>
                    <DeleteShiftButton id={s.id} date={date} />
                  </div>
                )}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
