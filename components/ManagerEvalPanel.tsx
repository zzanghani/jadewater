"use client";

import { useActionState, useState, useTransition } from "react";
import {
  collectManagerAuto,
  finalizeManagerReview,
  saveManagerScores,
} from "@/app/(app)/hr/manager-eval/actions";
import {
  applyProfitGate,
  managerAction,
  managerGrade,
  MANAGER_ITEMS,
  MANAGER_SECTIONS,
  MANAGER_GRADE_COLOR,
} from "@/lib/managerEval";
import type { Employee, ManagerReview } from "@/lib/types";

type AutoResult = Awaited<ReturnType<typeof collectManagerAuto>>;

function won(n: number): string {
  return `${Math.round(n / 10000).toLocaleString("ko-KR")}만원`;
}

export default function ManagerEvalPanel({
  managers,
  reviews,
  storeNameById,
  period,
  periodLabel,
}: {
  managers: Employee[];
  reviews: ManagerReview[];
  storeNameById: Map<string, string>;
  period: string;
  periodLabel: string;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [auto, setAuto] = useState<AutoResult | null>(null);
  const [loading, startLoad] = useTransition();

  const reviewByEmployee = new Map(reviews.map((r) => [r.employee_id, r]));
  const target = managers.find((m) => m.id === targetId) ?? null;

  function open(emp: Employee) {
    if (!emp.store_id) return;
    setTargetId(emp.id);
    setAuto(null);
    // 자동 지표는 무거운 집계라 목록에서 미리 뽑지 않고 열 때 계산한다.
    startLoad(async () => {
      setAuto(await collectManagerAuto(emp.store_id!, period));
    });
  }

  if (target) {
    return (
      <ManagerEvalForm
        employee={target}
        review={reviewByEmployee.get(target.id) ?? null}
        auto={auto}
        loading={loading}
        storeName={storeNameById.get(target.store_id ?? "") ?? "매장"}
        period={period}
        periodLabel={periodLabel}
        onBack={() => {
          setTargetId(null);
          setAuto(null);
        }}
      />
    );
  }

  const done = managers.filter((m) => reviewByEmployee.get(m.id)?.finalized_at).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold">점장 평가</span>
          <span className="text-xs text-muted">{periodLabel}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">확정</span>
          <span className="font-mono font-bold">
            {done} / {managers.length}명
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          100점 중 <b className="text-foreground">45점을 앱이 자동으로</b> 계산합니다.
          나머지는 대표 관찰 35 · 미스터리 쇼퍼 12 · 위생·안전 8점입니다.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {managers.map((emp) => {
          const review = reviewByEmployee.get(emp.id) ?? null;
          const finalized = !!review?.finalized_at;
          return (
            <li key={emp.id}>
              <button
                type="button"
                onClick={() => open(emp)}
                className="flex w-full flex-col gap-1 rounded-2xl border border-border bg-card p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{emp.name}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                    {storeNameById.get(emp.store_id ?? "") ?? "매장"}
                  </span>
                  {finalized && review?.grade && (
                    <span
                      className="ml-auto font-mono text-sm font-bold"
                      style={{ color: MANAGER_GRADE_COLOR[review.grade] }}
                    >
                      {review.grade} {review.total_score}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted">
                  {finalized
                    ? `확정 · ${managerAction(review!.grade!)}`
                    : review
                      ? "채점 중"
                      : "채점하기"}
                </span>
                {finalized && review?.gate_applied && (
                  <span className="text-[11px] font-semibold text-red-700">
                    적자 분기 — 손익 게이트로 등급 상한 B 적용
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {managers.length === 0 && (
          <li className="rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed text-muted">
            평가 대상 점장이 없습니다. 직원 명부에서 직급이 <b>점장</b>인 사람이 대상입니다.
          </li>
        )}
      </ul>
    </div>
  );
}

function ManagerEvalForm({
  employee,
  review,
  auto,
  loading,
  storeName,
  period,
  periodLabel,
  onBack,
}: {
  employee: Employee;
  review: ManagerReview | null;
  auto: AutoResult | null;
  loading: boolean;
  storeName: string;
  period: string;
  periodLabel: string;
  onBack: () => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(review?.scores ?? {});
  const [gateExempt, setGateExempt] = useState(review?.gate_exempt ?? false);
  const [state, formAction, pending] = useActionState(saveManagerScores, undefined);
  const [finalizing, startFinalize] = useTransition();
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // 자동 항목은 서버 계산값이 항상 이긴다.
  const merged = { ...scores, ...(auto?.scores ?? {}) };
  const total = MANAGER_ITEMS.reduce((sum, i) => sum + (merged[i.id] ?? 0), 0);
  const { grade, label } = managerGrade(total);
  const quarterProfit = auto?.quarterProfit ?? 0;
  const gated = applyProfitGate(grade, quarterProfit, gateExempt);

  const manualItems = MANAGER_ITEMS.filter((i) => !i.auto);
  const answeredManual = manualItems.filter((i) => typeof scores[i.id] === "number").length;
  const canFinalize = !!review && !review.finalized_at && answeredManual === manualItems.length;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="employee_id" value={employee.id} />
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="store_id" value={employee.store_id ?? ""} />

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="text-xs font-medium text-brand">
            ← 목록
          </button>
          <span className="ml-auto text-xs text-muted">{periodLabel}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold">{employee.name}</span>
          <span className="text-xs text-muted">{storeName} 점장</span>
        </div>

        {loading ? (
          <p className="text-xs text-muted">자동 지표를 계산하는 중입니다...</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">현재 점수</span>
              <span
                className="font-mono text-xl font-bold"
                style={{ color: MANAGER_GRADE_COLOR[gated.grade] }}
              >
                {gated.grade} {total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-brand-light">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${total}%`,
                  backgroundColor: MANAGER_GRADE_COLOR[gated.grade],
                }}
              />
            </div>
            <p className="text-[11px] text-muted">
              {label} · {managerAction(gated.grade)}
            </p>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted">수동 채점</span>
              <span className="font-mono font-bold">
                {answeredManual} / {manualItems.length} 항목
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── 손익 게이트 ─────────────────────────── */}
      {auto && (
        <div
          className={`flex flex-col gap-2 rounded-2xl border p-4 ${
            quarterProfit < 0 && !gateExempt
              ? "border-red-300 bg-red-50"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold">분기 손익</span>
            <span
              className={`font-mono text-sm font-bold ${
                quarterProfit < 0 ? "text-red-700" : "text-green-700"
              }`}
            >
              {quarterProfit < 0 ? "−" : "+"}
              {won(Math.abs(quarterProfit))}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {(auto.monthly ?? []).map((m) => (
              <div key={m.month} className="flex items-baseline justify-between text-xs">
                <span className="text-muted">
                  {Number(m.month.slice(5))}월{!m.hasData && " · 데이터 없음"}
                </span>
                <span className="font-mono">
                  {m.hasData ? `${m.netProfit < 0 ? "−" : ""}${won(Math.abs(m.netProfit))}` : "—"}
                </span>
              </div>
            ))}
          </div>
          {quarterProfit < 0 && (
            <>
              <p className="text-[11px] leading-relaxed text-red-700">
                적자 분기입니다. 총점과 무관하게 <b>등급 상한이 B</b>가 됩니다.
                성과 상여·상환 가속·출점 자격 누적이 모두 없습니다.
              </p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name="gate_exempt"
                  checked={gateExempt}
                  onChange={(e) => setGateExempt(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>
                  게이트 면제 — <b>개점 초기 계획된 적자</b>이거나 리모델링·휴업이 낀 분기
                </span>
              </label>
            </>
          )}
        </div>
      )}

      {/* ── 항목 ────────────────────────────────── */}
      {MANAGER_SECTIONS.map((section) => {
        const items = MANAGER_ITEMS.filter((i) => i.section === section.key);
        const sectionMax = items.reduce((s, i) => s + i.max, 0);
        const sectionScore = items.reduce((s, i) => s + (merged[i.id] ?? 0), 0);
        return (
          <div key={section.key} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2 px-1">
              <span className="text-sm font-bold">{section.key}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                {section.scorer}
              </span>
              <span className="ml-auto font-mono text-xs font-bold">
                {sectionScore} / {sectionMax}
              </span>
            </div>

            {items.map((item) => {
              const isAuto = !!item.auto;
              const autoScore = auto?.scores[item.id];
              const note = auto?.notes[item.id];
              const value = merged[item.id];
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold">{item.name}</span>
                    <span className="ml-auto font-mono text-xs text-muted">
                      {typeof value === "number" ? value : "—"} / {item.max}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">{item.desc}</p>
                  {item.scale && (
                    <p className="rounded-xl bg-background p-2.5 font-mono text-[11px] leading-relaxed text-muted">
                      {item.scale}
                    </p>
                  )}

                  {isAuto ? (
                    <p
                      className={`rounded-xl p-3 text-[11px] leading-relaxed ${
                        typeof autoScore === "number"
                          ? "bg-brand-light text-brand-dark"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {note ?? (loading ? "계산 중..." : "데이터 없음")}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: item.max + 1 }, (_, p) => item.max - p).map((point) => {
                        const on = scores[item.id] === point;
                        return (
                          <button
                            key={point}
                            type="button"
                            onClick={() => setScores((prev) => ({ ...prev, [item.id]: point }))}
                            className={`h-9 w-9 rounded-xl border font-mono text-sm font-bold transition-colors ${
                              on
                                ? "border-brand bg-brand text-white"
                                : "border-border bg-background text-muted"
                            }`}
                          >
                            {point}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {!isAuto && (
                    <input type="hidden" name={`score_${item.id}`} value={scores[item.id] ?? ""} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <span className="text-sm font-bold">종합의견</span>
        <textarea
          name="comment"
          rows={4}
          defaultValue={review?.comment ?? ""}
          placeholder="면담에서 그대로 읽어줄 내용을 적습니다."
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.success && <p className="text-xs text-green-700">저장했습니다.</p>}
      {finalizeError && <p className="text-xs text-red-600">{finalizeError}</p>}

      <button
        type="submit"
        disabled={pending || loading}
        className="rounded-xl bg-brand py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {pending ? "저장 중..." : "저장"}
      </button>

      {canFinalize && (
        <button
          type="button"
          disabled={finalizing}
          onClick={() => {
            if (!confirm("등급을 확정할까요? 확정하면 점장 본인에게도 보이고 되돌릴 수 없습니다."))
              return;
            setFinalizeError(null);
            startFinalize(async () => {
              const result = await finalizeManagerReview(review!.id);
              if (result.error) setFinalizeError(result.error);
            });
          }}
          className="rounded-xl border border-brand py-3 text-sm font-bold text-brand-dark disabled:opacity-40"
        >
          {finalizing ? "확정 중..." : "등급 확정"}
        </button>
      )}

      {review && !canFinalize && !review.finalized_at && (
        <p className="text-center text-[11px] text-muted">
          수동 항목을 모두 채점하고 저장해야 확정할 수 있습니다.
        </p>
      )}
    </form>
  );
}
