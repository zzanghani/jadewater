"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { saveEvalScores, finalizeEval } from "@/app/(app)/hr/eval/actions";
import {
  evalGrade,
  gradeAction,
  isProbation,
  rubricFor,
  scoreRubric,
  GRADE_COLOR,
} from "@/lib/evalRubric";
import { kstShortDateLabel } from "@/lib/date";
import type { Employee, EmployeeRecord, PerformanceReview } from "@/lib/types";

type Stage = "first" | "second";

export default function EvalPanel({
  employees,
  reviews,
  records,
  period,
  periodLabel,
}: {
  employees: Employee[];
  reviews: PerformanceReview[];
  records: EmployeeRecord[];
  period: string;
  periodLabel: string;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("first");

  const reviewByEmployee = useMemo(
    () => new Map(reviews.map((r) => [r.employee_id, r])),
    [reviews]
  );

  // 점장·파트타이머는 이 체계의 대상이 아니다(점장은 자동 지표 기반 별도 평가).
  const targets = employees.filter(
    (e) => rubricFor(e.position, e.team, isProbation(e.hire_date)) !== null
  );

  const target = targets.find((e) => e.id === targetId) ?? null;

  if (target) {
    return (
      <EvalForm
        employee={target}
        review={reviewByEmployee.get(target.id) ?? null}
        records={records.filter((r) => r.employee_id === target.id)}
        period={period}
        periodLabel={periodLabel}
        stage={stage}
        onBack={() => setTargetId(null)}
      />
    );
  }

  const done = targets.filter((e) => reviewByEmployee.get(e.id)?.finalized_at).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold">근무평가</span>
          <span className="text-xs text-muted">{periodLabel}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">확정</span>
          <span className="font-mono font-bold">
            {done} / {targets.length}명
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-brand-light">
          <div
            className="h-full rounded-full bg-brand-dark"
            style={{ width: `${targets.length ? (done / targets.length) * 100 : 0}%` }}
          />
        </div>
        <div className="flex gap-2">
          {(["first", "second"] as Stage[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors ${
                stage === s
                  ? "border-brand bg-brand/10 text-foreground"
                  : "border-border bg-background text-muted"
              }`}
            >
              {s === "first" ? "1차 · 점장 70%" : "2차 · 팀장·SV 30%"}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted">
          2차 평가자에게는 1차 점수가 보이지 않습니다. 따라 찍는 걸 막기 위해서입니다.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {targets.map((emp) => {
          const review = reviewByEmployee.get(emp.id) ?? null;
          const probation = isProbation(emp.hire_date);
          const rubric = rubricFor(emp.position, emp.team, probation)!;
          const finalized = !!review?.finalized_at;
          const stageDone =
            stage === "first" ? !!review?.first_submitted_at : !!review?.second_submitted_at;

          return (
            <li key={emp.id}>
              <button
                type="button"
                onClick={() => setTargetId(emp.id)}
                className="flex w-full flex-col gap-1 rounded-2xl border border-border bg-card p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{emp.name}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                    {rubric.label}
                  </span>
                  {probation && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      수습
                    </span>
                  )}
                  {finalized && review?.grade && (
                    <span
                      className="ml-auto font-mono text-sm font-bold"
                      style={{ color: GRADE_COLOR[review.grade] }}
                    >
                      {review.grade} {review.total_score}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted">
                  {finalized
                    ? `확정 · ${gradeAction(review!.grade!, probation, emp.position)}`
                    : stageDone
                      ? stage === "first"
                        ? "1차 완료 · 2차 대기"
                        : "2차 완료 · 확정 대기"
                      : "채점하기"}
                </span>
              </button>
            </li>
          );
        })}
        {targets.length === 0 && (
          <li className="rounded-2xl border border-border bg-card p-4 text-xs text-muted">
            평가 대상이 없습니다. 점장은 자동 지표 기반 별도 평가표를 씁니다.
          </li>
        )}
      </ul>
    </div>
  );
}

function EvalForm({
  employee,
  review,
  records,
  period,
  periodLabel,
  stage,
  onBack,
}: {
  employee: Employee;
  review: PerformanceReview | null;
  records: EmployeeRecord[];
  period: string;
  periodLabel: string;
  stage: Stage;
  onBack: () => void;
}) {
  const probation = isProbation(employee.hire_date);
  const rubric = rubricFor(employee.position, employee.team, probation)!;
  const saved = stage === "first" ? review?.first_scores : review?.second_scores;
  const [scores, setScores] = useState<Record<string, number>>(saved ?? {});
  const [state, formAction, pending] = useActionState(saveEvalScores, undefined);
  const [finalizing, startFinalize] = useTransition();
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const { total, byCategory } = scoreRubric(rubric, scores);
  const { grade, label } = evalGrade(total);
  const answered = Object.keys(scores).length;
  const canFinalize =
    !!review?.first_submitted_at && !!review?.second_submitted_at && !review?.finalized_at;

  const recordsByItem = useMemo(() => {
    const map = new Map<string, EmployeeRecord[]>();
    for (const r of records) {
      if (!r.eval_item) continue;
      const list = map.get(r.eval_item) ?? [];
      list.push(r);
      map.set(r.eval_item, list);
    }
    return map;
  }, [records]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="employee_id" value={employee.id} />
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="stage" value={stage} />

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="text-xs font-medium text-brand">
            ← 목록
          </button>
          <span className="ml-auto text-xs text-muted">
            {periodLabel} · {stage === "first" ? "1차" : "2차"}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold">{employee.name}</span>
          <span className="text-xs text-muted">{rubric.label}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">진행</span>
          <span className="font-mono font-bold">
            {answered} / {rubric.items.length} 문항
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-brand-light">
          <div
            className="h-full rounded-full bg-brand-dark"
            style={{ width: `${(answered / rubric.items.length) * 100}%` }}
          />
        </div>
        {answered === rubric.items.length && (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">환산 점수</span>
              <span className="font-mono text-xl font-bold" style={{ color: GRADE_COLOR[grade] }}>
                {grade} {total}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {byCategory.map((c) => (
                <div key={c.name} className="flex items-baseline justify-between text-xs">
                  <span className="text-muted">{c.name}</span>
                  <span className="font-mono">
                    {c.score} / {c.weight}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted">
              {label} · {gradeAction(grade, probation, employee.position)} · 커트라인 90/80/70/55
            </p>
          </>
        )}
      </div>

      {rubric.items.map((item, idx) => {
        const evidence = recordsByItem.get(item.name) ?? [];
        return (
          <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-muted">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-bold">{item.name}</span>
              {item.auto && (
                <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
                  자동 채점 예정
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted">{item.desc}</p>

            {evidence.length > 0 ? (
              <div className="flex flex-col gap-1.5 rounded-xl bg-brand-light p-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-dark">
                  이 분기 기록 {evidence.length}건
                </span>
                {evidence.map((r) => (
                  <div key={r.id} className="flex gap-2 text-[11px] leading-relaxed">
                    <span
                      className="shrink-0 font-mono font-semibold"
                      style={{ color: r.kind === "칭찬" ? "#15803d" : "#b91c1c" }}
                    >
                      {kstShortDateLabel(r.occurred_on)}
                    </span>
                    <span>{r.body}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-background p-3 text-[11px] leading-relaxed text-muted">
                이 분기 기록 없음. 기억에만 의존해 채점하게 됩니다.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              {[5, 4, 3, 2, 1].map((point) => {
                const on = scores[item.id] === point;
                return (
                  <button
                    key={point}
                    type="button"
                    onClick={() => setScores((prev) => ({ ...prev, [item.id]: point }))}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
                      on ? "border-brand bg-brand/10" : "border-border bg-background"
                    }`}
                  >
                    <span
                      className={`shrink-0 font-mono text-sm font-bold ${
                        on ? "text-brand-dark" : "text-muted"
                      }`}
                    >
                      {point}
                    </span>
                    <span className={`text-xs leading-relaxed ${on ? "" : "text-muted"}`}>
                      {item.anchors[5 - point]}
                    </span>
                  </button>
                );
              })}
            </div>
            <input type="hidden" name={`score_${item.id}`} value={scores[item.id] ?? ""} />
          </div>
        );
      })}

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <span className="text-sm font-bold">종합의견</span>
        <textarea
          name="comment"
          rows={4}
          defaultValue={(stage === "first" ? review?.first_comment : review?.second_comment) ?? ""}
          placeholder="면담에서 그대로 읽어줄 내용을 적습니다."
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <p className="text-xs text-muted">
          2점 이하를 준 문항이 있으면 무슨 일이 있었는지 적어야 제출됩니다.
        </p>
      </div>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.success && <p className="text-xs text-green-700">저장했습니다.</p>}
      {finalizeError && <p className="text-xs text-red-600">{finalizeError}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {pending ? "저장 중..." : stage === "first" ? "1차 제출" : "2차 제출"}
      </button>

      {canFinalize && (
        <button
          type="button"
          disabled={finalizing}
          onClick={() => {
            if (!confirm("등급을 확정할까요? 확정하면 본인에게도 보이고 되돌릴 수 없습니다.")) return;
            setFinalizeError(null);
            startFinalize(async () => {
              const result = await finalizeEval(review!.id);
              if (result.error) setFinalizeError(result.error);
            });
          }}
          className="rounded-xl border border-brand py-3 text-sm font-bold text-brand-dark disabled:opacity-40"
        >
          {finalizing ? "확정 중..." : "1차·2차 합산해 등급 확정"}
        </button>
      )}
    </form>
  );
}
