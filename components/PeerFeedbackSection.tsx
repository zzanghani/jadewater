"use client";

import { useActionState, useEffect, useState } from "react";
import { submitPeerFeedback, type EvalFormState } from "@/app/(app)/hr/eval/actions";
import type { PeerFeedback } from "@/lib/types";

export default function PeerFeedbackSection({
  employeeId,
  period,
  feedback,
}: {
  employeeId: string;
  period: string;
  feedback: PeerFeedback[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [state, formAction, pending] = useActionState<EvalFormState, FormData>(
    submitPeerFeedback,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      setShowForm(false);
      setRating(5);
    }
  }, [state]);

  const average =
    feedback.length > 0
      ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
      : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs font-bold">동료 피드백 <span className="font-normal text-muted">(참고용, 점수에 반영 안 됨)</span></span>
        {average && (
          <span className="flex items-center gap-1 text-xs font-bold text-muted">
            ★ {average} ({feedback.length})
          </span>
        )}
      </div>

      {feedback.length > 0 && (
        <ul className="flex flex-col gap-2">
          {feedback.map((f) => (
            <li key={f.id} className="rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{f.reviewer_name}</span>
                <span className="text-xs font-bold text-muted">{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</span>
              </div>
              {f.comment && <p className="mt-1 text-xs leading-relaxed text-muted">{f.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="self-start rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted"
        >
          + 동료 피드백 추가
        </button>
      ) : (
        <form action={formAction} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3.5">
          <input type="hidden" name="employee_id" value={employeeId} />
          <input type="hidden" name="period" value={period} />
          <input type="hidden" name="rating" value={rating} />

          <input
            type="text"
            name="reviewer_name"
            required
            placeholder="동료 이름"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />

          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`flex-1 rounded-lg border py-1.5 text-sm font-bold transition-colors ${
                  rating >= n ? "border-brand bg-brand text-white" : "border-border bg-background text-muted"
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
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />

          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-muted"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-brand py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {pending ? "저장 중..." : "추가"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
