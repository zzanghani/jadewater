"use client";

import { useActionState, useEffect, useState } from "react";
import { updateShift, type ScheduleFormState } from "@/app/(app)/schedule/actions";
import { BREAK_MINUTE_OPTIONS, SCHEDULE_ROLES, roleColor } from "@/lib/scheduleColors";
import AmPmTimeSelect from "@/components/AmPmTimeSelect";
import type { ScheduleRole, ScheduleShift } from "@/lib/types";

function splitTime(t: string): { period: "오전" | "오후"; hour: number; minute: number } {
  const [h, m] = t.split(":").map(Number);
  const period: "오전" | "오후" = h < 12 ? "오전" : "오후";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { period, hour, minute: m };
}

export default function ScheduleShiftEditForm({
  shift,
  date,
  onCancel,
  onSaved,
}: {
  shift: ScheduleShift;
  date: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState<ScheduleFormState, FormData>(
    updateShift,
    undefined
  );
  const [role, setRole] = useState<ScheduleRole>(shift.role);

  useEffect(() => {
    if (state?.success) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const start = splitTime(shift.start_time);
  const end = splitTime(shift.end_time);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-brand bg-card p-3"
    >
      <input type="hidden" name="id" value={shift.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="role" value={role} />

      <div className="flex flex-wrap gap-1.5">
        {SCHEDULE_ROLES.map((r) => {
          const selected = role === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              style={selected ? { backgroundColor: roleColor(r) } : undefined}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                selected
                  ? "text-white shadow-sm"
                  : "border border-border bg-background text-muted"
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        name="employee_name"
        required
        defaultValue={shift.employee_name}
        className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-brand/30 focus:ring-2"
      />

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        출근
        <AmPmTimeSelect
          name="start_time"
          defaultPeriod={start.period}
          defaultHour={start.hour}
          defaultMinute={start.minute}
        />
      </div>
      <div className="flex flex-col gap-1.5 text-sm font-medium">
        퇴근
        <AmPmTimeSelect
          name="end_time"
          defaultPeriod={end.period}
          defaultHour={end.hour}
          defaultMinute={end.minute}
        />
      </div>

      <select
        name="break_minutes"
        defaultValue={shift.break_minutes}
        className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-brand/30 focus:ring-2"
      >
        {BREAK_MINUTE_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {m === 0 ? "휴게시간 없음" : `휴게시간 ${m}분`}
          </option>
        ))}
      </select>

      <input
        type="text"
        name="notes"
        defaultValue={shift.notes ?? ""}
        placeholder="메모 (선택)"
        className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
      />

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/30 disabled:opacity-60"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}
