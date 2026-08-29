"use client";

import { useActionState, useState } from "react";
import { saveSelfScores } from "@/app/(app)/my-review/actions";
import {
  evalGrade,
  gradeAction,
  isProbation,
  rubricFor,
  GRADE_COLOR,
} from "@/lib/evalRubric";
import { kstShortDateLabel } from "@/lib/date";
import type { Employee, EmployeeRecord, PerformanceReview } from "@/lib/types";

function periodLabelOf(period: string): string {
  const [year, q] = period.split("-Q");
  return `${year}년 ${q}분기`;
}

export default function SelfReview({
  employee,
  reviews,
  records,
  period,
  periodLabel,
}: {
  employee: Employee;
  reviews: PerformanceReview[];
  records: EmployeeRecord[];
  period: string;
  periodLabel: string;
}) {
  const probation = isProbation(employee.hire_date);
  const rubric = rubricFor(employee.position, employee.team, probation);

  const current = reviews.find((r) => r.period === period) ?? null;
  const finalizedList = reviews.filter((r) => r.finalized_at);
  const latestFinal = finalizedList[0] ?? null;

  // 근태는 앱이 자동 산출하므로 자기평가에서 뺀다.
  const items = rubric?.items.filter((i) => !i.auto) ?? [];
  const [scores, setScores] = useState<Record<string, number>>(current?.self_scores ?? {});
  const [state, formAction, pending] = useActionState(saveSelfScores, undefined);
  const [editing, setEditing] = useState(false);

  const submitted = !!current?.self_submitted_at;
  const answered = Object.keys(scores).length;

  if (!rubric) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-bold">내 평가</h1>
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">
          {employee.position}은 별도 평가 체계를 씁니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">내 평가</h1>

      {/* ── 다음 분기 목표 · 중간 체크인 ─────────────── */}
      {(current?.next_goals || current?.midterm_good || current?.midterm_improve) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-brand bg-brand-light p-4">
          {current?.next_goals && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark">
                이번 분기 목표
              </span>
              <p className="text-sm leading-relaxed">{current.next_goals}</p>
            </div>
          )}
          {(current?.midterm_good || current?.midterm_improve) && (
            <div className="flex flex-col gap-2 border-t border-brand/40 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark">
                중간 체크인
              </span>
              {current?.midterm_good && (
                <p className="text-sm leading-relaxed">
                  <b className="text-green-700">잘한 것</b> · {current.midterm_good}
                </p>
              )}
              {current?.midterm_improve && (
                <p className="text-sm leading-relaxed">
                  <b className="text-orange-600">고칠 것</b> · {current.midterm_improve}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 확정된 최근 평가 ────────────────────── */}
      {latestFinal && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold">{periodLabelOf(latestFinal.period)} 평가 결과</span>
            <span className="text-xs text-muted">확정</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-white"
              style={{ backgroundColor: GRADE_COLOR[latestFinal.grade ?? "B"] }}
            >
              {latestFinal.grade}
            </span>
            <div className="flex flex-col">
              <span className="font-mono text-xl font-bold">
                {latestFinal.total_score}
                <span className="text-sm font-medium text-muted"> / 100</span>
              </span>
              <span className="text-xs text-muted">
                {evalGrade(latestFinal.total_score ?? 0).label} ·{" "}
                {gradeAction(latestFinal.grade ?? "B", probation, employee.position)}
              </span>
            </div>
          </div>
          {latestFinal.demotion_reason && (
            <p className="rounded-xl bg-red-50 p-3 text-[11px] leading-relaxed text-red-700">
              {latestFinal.demotion_reason}
            </p>
          )}

          {/* 자기평가 갭 — 이 화면의 핵심 */}
          {latestFinal.self_submitted_at && (
            <GapList
              rubric={rubric}
              self={latestFinal.self_scores}
              first={latestFinal.first_scores}
              second={latestFinal.second_scores}
            />
          )}

          {latestFinal.first_comment && (
            <div className="flex flex-col gap-1 border-t border-border pt-3">
              <span className="text-[11px] font-semibold text-muted">점장 종합의견</span>
              <p className="text-sm leading-relaxed">{latestFinal.first_comment}</p>
            </div>
          )}
        </div>
      )}

      {/* ── 이번 분기 자기평가 ───────────────────── */}
      {submitted && !editing ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold">{periodLabel} 자기평가</span>
            <span className="text-xs text-green-700">제출 완료</span>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            제출했습니다. 점장님 채점이 끝나면 면담에서 내 점수와 비교해 봅니다.
          </p>
          {!current?.finalized_at && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="self-start text-xs font-semibold text-brand"
            >
              다시 쓰기
            </button>
          )}
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="period" value={period} />

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold">{periodLabel} 자기평가</span>
              <span className="font-mono text-xs text-muted">
                {answered} / {items.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-brand-light">
              <div
                className="h-full rounded-full bg-brand-dark"
                style={{ width: `${items.length ? (answered / items.length) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs leading-relaxed text-muted">
              <b className="text-foreground">이 점수는 평가 점수에 반영되지 않습니다.</b>{" "}
              점장님이 매긴 점수와 나란히 놓고, 생각이 다른 항목을 면담에서 이야기하기 위한 것입니다.
              솔직하게 쓰는 쪽이 본인에게 도움이 됩니다.
            </p>
          </div>

          {items.map((item, idx) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-muted">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-bold">{item.name}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted">{item.desc}</p>

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
              <input type="hidden" name={`self_${item.id}`} value={scores[item.id] ?? ""} />
            </div>
          ))}

          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
          {state?.success && <p className="text-xs text-green-700">제출했습니다.</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-brand py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {pending ? "제출 중..." : "자기평가 제출"}
          </button>
        </form>
      )}

      {/* ── 내가 받은 칭찬 ──────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="text-sm font-bold">{periodLabel}에 받은 기록</span>
        {records.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted">
            아직 공개된 기록이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {records.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-1 border-l-[3px] pl-3"
                style={{ borderColor: r.kind === "칭찬" ? "#15803d" : "#b91c1c" }}
              >
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <span className="font-mono font-semibold">
                    {kstShortDateLabel(r.occurred_on)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      r.kind === "칭찬" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {r.kind}
                  </span>
                  {r.eval_item && (
                    <span className="rounded-full bg-brand-light px-2 py-0.5 font-semibold text-brand-dark">
                      {r.eval_item}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 지난 평가 추이 ─────────────────────── */}
      {finalizedList.length > 1 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <span className="text-sm font-bold">지난 평가</span>
          {finalizedList.slice(1).map((r) => (
            <div key={r.id} className="flex items-baseline justify-between text-sm">
              <span className="text-muted">{periodLabelOf(r.period)}</span>
              <span
                className="font-mono font-bold"
                style={{ color: GRADE_COLOR[r.grade ?? "B"] }}
              >
                {r.grade} {r.total_score}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 자기 점수와 평가 점수의 차이를 큰 순서로 보여준다.
// 이 목록이 면담에서 먼저 이야기할 항목이 된다.
function GapList({
  rubric,
  self,
  first,
  second,
}: {
  rubric: NonNullable<ReturnType<typeof rubricFor>>;
  self: Record<string, number>;
  first: Record<string, number>;
  second: Record<string, number>;
}) {
  const rows = rubric.items
    .filter((i) => !i.auto && typeof self[i.id] === "number")
    .map((item) => {
      const a = first[item.id];
      const b = second[item.id];
      const rated =
        typeof a === "number" && typeof b === "number"
          ? a * 0.7 + b * 0.3
          : typeof a === "number"
            ? a
            : typeof b === "number"
              ? b
              : null;
      return { item, mine: self[item.id], rated };
    })
    .filter((r): r is { item: (typeof rubric.items)[number]; mine: number; rated: number } =>
      r.rated !== null
    )
    .map((r) => ({ ...r, gap: r.mine - r.rated }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 4);

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <span className="text-[11px] font-semibold text-muted">
        내 생각과 가장 달랐던 항목
      </span>
      {rows.map(({ item, mine, rated, gap }) => (
        <div key={item.id} className="flex items-baseline gap-2 text-xs">
          <span className="flex-1 truncate">{item.name}</span>
          <span className="font-mono text-muted">내 {mine}</span>
          <span className="font-mono text-muted">평가 {rated.toFixed(1)}</span>
          <span
            className={`w-10 text-right font-mono font-bold ${
              gap > 0 ? "text-orange-600" : gap < 0 ? "text-green-700" : "text-muted"
            }`}
          >
            {gap > 0 ? "+" : ""}
            {gap.toFixed(1)}
          </span>
        </div>
      ))}
      <p className="text-[11px] leading-relaxed text-muted">
        <b className="text-orange-600">+</b>는 내가 더 높게 본 항목,{" "}
        <b className="text-green-700">−</b>는 점장님이 더 높게 본 항목입니다.
      </p>
    </div>
  );
}
