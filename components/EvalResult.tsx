"use client";

import { evalGrade, evalRubricFor, GRADE_COLOR } from "@/lib/evalRubric";
import PeerFeedbackSection from "@/components/PeerFeedbackSection";
import type { Employee, PeerFeedback, PerformanceReview } from "@/lib/types";

export default function EvalResult({
  employee,
  review,
  history,
  peerFeedback,
  onEdit,
}: {
  employee: Employee;
  review: PerformanceReview;
  history: PerformanceReview[];
  peerFeedback: PeerFeedback[];
  onEdit: () => void;
}) {
  const rubric = evalRubricFor(employee.team!);
  const maxTotal = rubric.length * 5;
  const { grade, label, comp } = evalGrade(review.total_score);
  const color = GRADE_COLOR[grade];

  const categories = (() => {
    const order: string[] = [];
    const totals: Record<string, { score: number; max: number }> = {};
    for (const item of rubric) {
      if (!totals[item.category]) {
        totals[item.category] = { score: 0, max: 0 };
        order.push(item.category);
      }
      totals[item.category].score += review.scores[item.id] ?? 0;
      totals[item.category].max += 5;
    }
    return order.map((cat) => ({ category: cat, ...totals[cat] }));
  })();

  const pastReviews = history.filter((r) => r.id !== review.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">평가 결과</span>
        <button type="button" onClick={onEdit} className="text-sm font-semibold text-brand">
          수정
        </button>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-6 text-center">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {grade}
        </span>
        <span className="text-sm font-bold">{employee.name} · {label}</span>
        <span className="text-xs text-muted">
          {employee.team}(정직원) · {review.period.replace("-", "년 ")}월 평가
        </span>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full"
            style={{ width: `${(review.total_score / maxTotal) * 100}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-xs font-bold" style={{ color }}>
          {review.total_score} / {maxTotal}점
        </span>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-background px-4 py-3">
        <span className="text-xs font-semibold text-muted">재계약 · 연봉조정 가이드라인</span>
        <span className="text-sm font-bold" style={{ color }}>
          {comp}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="px-0.5 text-xs font-bold">항목별 점수</span>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          {categories.map((c) => (
            <div key={c.category} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>{c.category}</span>
                <span>
                  {c.score} / {c.max}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${(c.score / c.max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {review.comment && (
        <div className="flex flex-col gap-2">
          <span className="px-0.5 text-xs font-bold">종합의견</span>
          <p className="rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed">
            {review.comment}
          </p>
        </div>
      )}

      {review.evaluator_note && (
        <p className="text-xs text-muted">평가자: {review.evaluator_note}</p>
      )}

      <PeerFeedbackSection employeeId={employee.id} period={review.period} feedback={peerFeedback} />

      {pastReviews.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="px-0.5 text-xs font-bold">평가 이력</span>
          <ul className="flex flex-col gap-2">
            {pastReviews.map((r) => {
              const g = evalGrade(r.total_score);
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: GRADE_COLOR[g.grade] }}
                    />
                    <span className="text-sm font-semibold">{r.period.replace("-", "년 ")}월</span>
                  </div>
                  <span className="text-xs text-muted">
                    {g.grade} · {r.total_score}점
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
