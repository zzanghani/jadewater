"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteShift, saveCellShift } from "@/app/(app)/schedule/actions";
import { BREAK_MINUTE_OPTIONS, SCHEDULE_ROLES, roleColor } from "@/lib/scheduleColors";
import { kstDateLabel } from "@/lib/date";
import AmPmTimeSelect, { parseTimeTo12h } from "@/components/AmPmTimeSelect";
import type { ScheduleRole, ScheduleShift } from "@/lib/types";

export default function ScheduleCellForm({
  date,
  employeeName,
  defaultRole,
  shift,
  onClose,
}: {
  date: string;
  employeeName: string;
  defaultRole: ScheduleRole;
  shift: ScheduleShift | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveCellShift, undefined);
  const [role, setRole] = useState<ScheduleRole>(shift?.role ?? defaultRole);
  const startDefault = parseTimeTo12h(shift?.start_time ?? "09:00");
  const endDefault = parseTimeTo12h(shift?.end_time ?? "18:00");

  useEffect(() => {
    if (!state?.success) return;
    router.refresh();
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleDelete() {
    if (!shift) return;
    if (!window.confirm("이 근무를 삭제하고 OFF로 표시할까요?")) return;
    const formData = new FormData();
    formData.set("id", shift.id);
    formData.set("date", date);
    deleteShift(formData).then(() => {
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">
            {employeeName} · {kstDateLabel(date)}
          </h3>
          <button type="button" onClick={onClose} className="text-lg text-muted">
            ✕
          </button>
        </div>

        <input type="hidden" name="id" value={shift?.id ?? ""} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="employee_name" value={employeeName} />

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          직급
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
        </div>

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          출근
          <AmPmTimeSelect
            name="start_time"
            defaultPeriod={startDefault.period}
            defaultHour={startDefault.hour}
            defaultMinute={startDefault.minute}
          />
        </div>
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          퇴근
          <AmPmTimeSelect
            name="end_time"
            defaultPeriod={endDefault.period}
            defaultHour={endDefault.hour}
            defaultMinute={endDefault.minute}
          />
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          휴게시간
          <select
            name="break_minutes"
            defaultValue={shift?.break_minutes ?? 0}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-brand/30 focus:ring-2"
          >
            {BREAK_MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "없음" : `${m}분`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          메모 <span className="font-normal text-muted">(선택)</span>
          <input
            type="text"
            name="notes"
            defaultValue={shift?.notes ?? ""}
            placeholder="예: 오픈조, 마감조"
            className="rounded-xl border border-border bg-background px-4 py-2.5 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
        </label>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}

        <div className="flex gap-2">
          {shift && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-600"
            >
              삭제 (OFF)
            </button>
          )}
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
          >
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
