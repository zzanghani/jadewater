"use client";

import { useActionState, useEffect, useState } from "react";
import { unlockScheduleAdmin } from "@/app/(app)/schedule/actions";
import { roleColor } from "@/lib/scheduleColors";
import DeleteShiftButton from "@/components/DeleteShiftButton";
import ScheduleShiftEditForm from "@/components/ScheduleShiftEditForm";
import type { ScheduleShift } from "@/lib/types";

export default function ScheduleShiftList({
  shifts,
  date,
}: {
  shifts: ScheduleShift[];
  date: string;
}) {
  const [unlockState, unlockAction, unlockPending] = useActionState(
    unlockScheduleAdmin,
    undefined
  );
  const [unlocked, setUnlocked] = useState(false);
  const [showUnlockForm, setShowUnlockForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (unlockState?.success) {
      setUnlocked(true);
      setShowUnlockForm(false);
    }
  }, [unlockState]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        {unlocked ? (
          <span className="text-[11px] font-medium text-muted">🔓 수정·삭제 가능</span>
        ) : (
          <button
            type="button"
            onClick={() => setShowUnlockForm((v) => !v)}
            className="text-[11px] font-medium text-muted underline-offset-2 hover:underline"
          >
            🔒 수정·삭제 잠금 해제
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
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{unlockState.error}</p>
      )}

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
                    {s.notes ? ` · ${s.notes}` : ""}
                  </p>
                </div>
                {unlocked && (
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
