"use client";

import { useActionState, useEffect, useState } from "react";
import { addShift, type ScheduleFormState } from "@/app/(app)/schedule/actions";
import { SCHEDULE_ROLES, roleColor } from "@/lib/scheduleColors";
import AmPmTimeSelect from "@/components/AmPmTimeSelect";
import type { ScheduleRole } from "@/lib/types";

export default function ScheduleShiftForm({ date }: { date: string }) {
  const [state, formAction, pending] = useActionState<ScheduleFormState, FormData>(
    addShift,
    undefined
  );
  const [role, setRole] = useState<ScheduleRole>(SCHEDULE_ROLES[0]);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!state?.success) return;
    setResetKey((k) => k + 1);
  }, [state]);

  return (
    <form
      key={resetKey}
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="role" value={role} />

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        직급
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
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        이름
        <input
          type="text"
          name="employee_name"
          required
          placeholder="이름을 입력하세요"
          className="rounded-xl border border-border bg-background px-4 py-2.5 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        출근
        <AmPmTimeSelect name="start_time" defaultPeriod="오전" defaultHour={9} defaultMinute={0} />
      </div>
      <div className="flex flex-col gap-1.5 text-sm font-medium">
        퇴근
        <AmPmTimeSelect name="end_time" defaultPeriod="오후" defaultHour={6} defaultMinute={0} />
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        메모 <span className="font-normal text-muted">(선택)</span>
        <input
          type="text"
          name="notes"
          placeholder="예: 오픈조, 마감조"
          className="rounded-xl border border-border bg-background px-4 py-2.5 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
      >
        {pending ? "추가 중..." : "근무자 추가"}
      </button>
    </form>
  );
}
