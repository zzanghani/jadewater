"use client";

import { useActionState, useEffect, useState } from "react";
import { submitPeerFeedback, type PeerFeedbackFormState } from "@/app/(app)/peer-feedback/actions";
import { evalPeriodLabel } from "@/lib/evalRubric";
import { roleColor } from "@/lib/scheduleColors";
import type { Employee } from "@/lib/types";

export default function PeerFeedbackPageClient({
  storeName,
  period,
  employees,
  submittedIds,
}: {
  storeName: string;
  period: string;
  employees: Employee[];
  submittedIds: string[];
}) {
  const [done, setDone] = useState(new Set(submittedIds));
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-bold">동료 한마디</h1>
        <p className="text-xs text-muted">
          {storeName} · {evalPeriodLabel(period)} · 익명으로 전달돼요. 누가 썼는지는 아무도(관리자 포함) 알 수 없어요.
        </p>
      </div>

      {employees.length === 0 ? (
        <p className="text-sm text-muted">같은 매장에 등록된 동료가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {employees.map((emp) => (
            <li key={emp.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: roleColor(emp.position) }}
                >
                  {emp.name.slice(0, 1)}
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold">{emp.name}</span>
                  <span className="text-xs text-muted">{emp.position} · {emp.team}</span>
                </div>
                {done.has(emp.id) ? (
                  <span className="shrink-0 rounded-full bg-brand-light px-3 py-1.5 text-xs font-bold text-brand-dark">
                    제출 완료
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === emp.id ? null : emp.id)}
                    className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white"
                  >
                    피드백 남기기
                  </button>
                )}
              </div>

              {openId === emp.id && !done.has(emp.id) && (
                <PeerFeedbackForm
                  employeeId={emp.id}
                  period={period}
                  onDone={() => {
                    setDone((prev) => new Set(prev).add(emp.id));
                    setOpenId(null);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PeerFeedbackForm({
  employeeId,
  period,
  onDone,
}: {
  employeeId: string;
  period: string;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [state, formAction, pending] = useActionState<PeerFeedbackFormState, FormData>(
    submitPeerFeedback,
    undefined
  );

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-2.5 rounded-xl bg-background p-3">
      <input type="hidden" name="employee_id" value={employeeId} />
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="rating" value={rating} />

      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`flex-1 rounded-lg border py-1.5 text-sm font-bold transition-colors ${
              rating >= n ? "border-brand bg-brand text-white" : "border-border bg-card text-muted"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        name="comment"
        rows={2}
        placeholder="한 줄 코멘트 (선택)"
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
      />

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand py-2 text-xs font-bold text-white disabled:opacity-60"
      >
        {pending ? "제출 중..." : "익명으로 제출"}
      </button>
    </form>
  );
}
