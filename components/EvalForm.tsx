"use client";

import { useActionState, useMemo, useState } from "react";
import { submitPerformanceReview, type EvalFormState } from "@/app/(app)/hr/eval/actions";
import { evalPeriodLabel, evalRubricFor } from "@/lib/evalRubric";
import type { Employee } from "@/lib/types";

const SCALE_LABELS = ["불량", "미흡", "보통", "우수", "탁월"];

export default function EvalForm({
  employee,
  period,
  existingScores,
  existingComment,
  existingEvaluatorNote,
  onSaved,
}: {
  employee: Employee;
  period: string;
  existingScores?: Record<string, number>;
  existingComment?: string | null;
  existingEvaluatorNote?: string | null;
  onSaved?: () => void;
}) {
  const rubric = evalRubricFor(employee.team!);
  const [state, formAction, pending] = useActionState<EvalFormState, FormData>(
    submitPerformanceReview,
    undefined
  );
  const [scores, setScores] = useState<Record<string, number>>(
    () => existingScores ?? Object.fromEntries(rubric.map((item) => [item.id, 0]))
  );

  const total = useMemo(() => Object.values(scores).reduce((sum, v) => sum + v, 0), [scores]);
  const maxTotal = rubric.length * 5;

  const categories = useMemo(() => {
    const order: string[] = [];
    const groups: Record<string, typeof rubric> = {};
    for (const item of rubric) {
      if (!groups[item.category]) {
        groups[item.category] = [];
        order.push(item.category);
      }
      groups[item.category].push(item);
    }
    return order.map((cat) => ({ category: cat, items: groups[cat] }));
  }, [rubric]);

  if (state?.success) onSaved?.();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="employee_id" value={employee.id} />
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="team" value={employee.team ?? ""} />
      {rubric.map((item) => (
        <input key={item.id} type="hidden" name={`score_${item.id}`} value={scores[item.id] || ""} />
      ))}

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-bold">{employee.name} · 근무평가</span>
          <span className="text-xs text-muted">
            {employee.team}(정직원) · {evalPeriodLabel(period)}
          </span>
        </div>
        <div className="flex items-baseline gap-1 rounded-full border border-border bg-background px-3 py-1">
          <span className="text-sm font-bold text-brand">{total}</span>
          <span className="text-xs text-muted">/ {maxTotal}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border bg-background px-4 py-3 text-xs text-muted">
        <span className="font-semibold">5점 만점 척도</span>
        <span>5 탁월(S) · 4 우수(A) · 3 보통(B) · 2 미흡(C) · 1 불량(D)</span>
      </div>

      {categories.map(({ category, items }) => (
        <div key={category} className="flex flex-col gap-2.5">
          <span className="flex items-center gap-1.5 px-0.5 text-xs font-bold uppercase tracking-wide text-brand-dark">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {category}
          </span>
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5">
              <span className="text-sm font-bold">{item.name}</span>
              <span className="text-xs leading-relaxed text-muted">{item.desc}</span>
              <div className="mt-0.5 flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = scores[item.id] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScores((prev) => ({ ...prev, [item.id]: n }))}
                      className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl border py-2 transition-colors ${
                        active ? "border-brand bg-brand text-white" : "border-border bg-background text-foreground"
                      }`}
                    >
                      <span className="text-sm font-bold">{n}</span>
                      <span className={`text-[9px] font-semibold ${active ? "text-white/90" : "text-muted"}`}>
                        {SCALE_LABELS[n - 1]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        종합의견
        <textarea
          name="comment"
          rows={3}
          defaultValue={existingComment ?? ""}
          placeholder="종합의견을 작성해 주세요"
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        평가자 확인 <span className="font-normal text-muted">(예: 점장 홍길동 · SV 확인)</span>
        <input
          type="text"
          name="evaluator_note"
          defaultValue={existingEvaluatorNote ?? ""}
          placeholder="평가자 이름을 입력하세요"
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand py-3.5 text-sm font-bold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
      >
        {pending ? "저장 중..." : "평가 저장 · 결과 계산"}
      </button>
    </form>
  );
}
