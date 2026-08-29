"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteShift, saveCellShift } from "@/app/(app)/schedule/actions";
import { BREAK_MINUTE_OPTIONS, SCHEDULE_ROLES, roleColor } from "@/lib/scheduleColors";
import { kstDateLabel } from "@/lib/date";
import AmPmTimeSelect, { parseTimeTo12h, type TimeValue } from "@/components/AmPmTimeSelect";
import SchedulePresetManager from "@/components/SchedulePresetManager";
import type { ScheduleRole, ScheduleShift, ScheduleShiftPreset } from "@/lib/types";

export default function ScheduleCellForm({
  date,
  employeeName,
  defaultRole,
  shift,
  presets,
  onClose,
}: {
  date: string;
  employeeName: string;
  defaultRole: ScheduleRole;
  shift: ScheduleShift | null;
  presets: ScheduleShiftPreset[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveCellShift, undefined);
  const [role, setRole] = useState<ScheduleRole>(shift?.role ?? defaultRole);
  const [start, setStart] = useState<TimeValue>(parseTimeTo12h(shift?.start_time ?? "09:00"));
  const [end, setEnd] = useState<TimeValue>(parseTimeTo12h(shift?.end_time ?? "18:00"));
  const [breakMinutes, setBreakMinutes] = useState(shift?.break_minutes ?? 0);
  const [managingPresets, setManagingPresets] = useState(false);

  useEffect(() => {
    if (!state?.success) return;
    router.refresh();
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function applyPreset(preset: ScheduleShiftPreset) {
    setStart(parseTimeTo12h(preset.start_time));
    setEnd(parseTimeTo12h(preset.end_time));
    setBreakMinutes(preset.break_minutes);
  }

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
          <div className="flex items-center justify-between">
            빠른입력
            <button
              type="button"
              onClick={() => setManagingPresets(true)}
              className="text-xs font-medium text-muted underline-offset-2 hover:underline"
            >
              프리셋 관리
            </button>
          </div>
          {presets.length === 0 ? (
            <p className="text-xs text-muted">
              등록된 프리셋이 없어요. "프리셋 관리"에서 오픈조·미들조·마감조를 만들어보세요.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          출근
          <AmPmTimeSelect name="start_time" value={start} onChange={setStart} />
        </div>
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          퇴근
          <AmPmTimeSelect name="end_time" value={end} onChange={setEnd} />
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          휴게시간
          <select
            name="break_minutes"
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value))}
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

      {managingPresets && (
        <SchedulePresetManager presets={presets} onClose={() => setManagingPresets(false)} />
      )}
    </div>
  );
}
