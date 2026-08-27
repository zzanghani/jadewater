"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
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
  MANAGER_TOTAL,
} from "@/lib/managerEval";
import type { Employee, ManagerReview } from "@/lib/types";

type AutoData = Awaited<ReturnType<typeof collectManagerAuto>>;

export default function ManagerEvalPanel({
  managers,
  reviews,
  period,
  periodLabel,
  storeNameById,
}: {
  managers: Employee[];
  reviews: ManagerReview[];
  period: string;
  periodLabel: string;
  storeNameById: Map<string, string>;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = managers.find((m) => m.id === targetId) ?? null;

  if (target) {
    return (
      <ManagerEvalForm
        manager={target}
        review={reviews.find((r) => r.employee_id === target.id) ?? null}
        period={period}
        periodLabel={periodLabel}
        storeName={storeNameById.get(target.store_id ?? "") ?? "매장"}
        onBack={() => setTargetId(null)}
      />
    );
  }

  const done = managers.filter(
    (m) => reviews.find((r) => r.employee_id === m.id)?.finalized_at
  ).length;

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
          직원 평가와 배점이 다릅니다. <b className="text-foreground">45점을 앱이 자동으로</b>{" "}
          채점하고(자립·자산보존 일부·운영규율), 나머지는 대표 관찰 35 · 미스터리 쇼퍼 12 ·
          SV 위생·안전 8입니다.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MANAGER_SECTIONS.map((s) => (
            <span
              key={s.key}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted"
            >
              {s.key} {s.weightLabel}
            </span>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {managers.map((m) => {
          const review = reviews.find((r) => r.employee_id === m.id) ?? null;
          const finalized = !!review?.finalized_at;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setTargetId(m.id)}
                className="flex w-full flex-col gap-1 rounded-2xl border border-border bg-card p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{m.name}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                    {storeNameById.get(m.store_id ?? "") ?? "매장"} · {m.position}
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
              </button>
            </li>
          );
        })}
        {managers.length === 0 && (
          <li className="rounded-2xl border border-border bg-card p-4 text-xs text-muted">
            평가할 점장이 없습니다. 직원 명부에서 직급이 점장·부점장인 사람이 대상입니다.
          </li>
        )}
      </ul>
    </div>
  );
}

function ManagerEvalForm({
  manager,
  review,
  period,
  periodLabel,
  storeName,
  onBack,
}: {
  manager: Employee;
  review: ManagerReview | null;
  period: string;
  periodLabel: string;
  storeName: string;
  onBack: () => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(review?.scores ?? {});
  const [auto, setAuto] = useState<AutoData | null>(null);
  // 매장이 없는 사람(본사 소속 등)은 애초에 자동 지표를 뽑을 게 없으므로
  // 로딩 상태로 시작하지 않는다 — effect 안에서 동기로 상태를 바꾸지 않기 위해서.
  const [loadingAuto, setLoadingAuto] = useState(!!manager.store_id);
  const [gateExempt, setGateExempt] = useState(review?.gate_exempt ?? false);
  const [state, formAction, pending] = useActionState(saveManagerScores, undefined);
  const [finalizing, startFinalize] = useTransition();
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // 자동 지표는 화면을 열 때 앱 데이터에서 실제로 뽑아 온다.
  useEffect(() => {
    if (!manager.store_id) return;
    let alive = true;
    collectManagerAuto(manager.store_id, period)
      .then((result) => {
        if (!alive) return;
        setAuto(result);
        setScores((prev) => ({ ...prev, ...result.scores }));
      })
      .finally(() => {
        if (alive) setLoadingAuto(false);
      });
    return () => {
      alive = false;
    };
  }, [manager.store_id, period]);

  const manualItems = MANAGER_ITEMS.filter((i) => !i.auto);
  const answeredManual = manualItems.filter((i) => typeof scores[i.id] === "number").length;
  const total = MANAGER_ITEMS.reduce((sum, i) => sum + (scores[i.id] ?? 0), 0);
  const { grade, label } = managerGrade(total);
  const quarterProfit = auto?.quarterProfit ?? 0;
  const gated = applyProfitGate(grade, quarterProfit, gateExempt);

  const canFinalize = !!review && !review.finalized_at && answeredManual === manualItems.length;

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="employee_id" value={manager.id} />
        <input type="hidden" name="period" value={period} />
        <input type="hidden" name="store_id" value={manager.store_id ?? ""} />

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onBack} className="text-xs font-medium text-brand">
              ← 목록
            </button>
            <span className="ml-auto text-xs text-muted">{periodLabel}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold">{manager.name}</span>
            <span className="text-xs text-muted">
              {storeName} · {manager.position}
            </span>
          </div>

          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted">사람이 채점할 항목</span>
            <span className="font-mono font-bold">
              {answeredManual} / {manualItems.length}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-brand-light">
            <div
              className="h-full rounded-full bg-brand-dark"
              style={{ width: `${(answeredManual / manualItems.length) * 100}%` }}
            />
          </div>

          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm text-muted">현재 점수</span>
            <span
              className="font-mono text-xl font-bold"
              style={{ color: MANAGER_GRADE_COLOR[gated.grade] }}
            >
              {gated.grade} {total}
              <span className="text-sm font-medium text-muted"> / {MANAGER_TOTAL}</span>
            </span>
          </div>
          <p className="text-[11px] text-muted">
            {label} · {managerAction(gated.grade)} · 커트라인 90/80/70/60
          </p>

          {/* 손익 게이트 */}
          {!loadingAuto && (
            <div
              className={`flex flex-col gap-2 rounded-xl p-3 ${
                quarterProfit < 0 ? "bg-red-50" : "bg-background"
              }`}
            >
              <div className="flex items-baseline justify-between text-xs">
                <span className={quarterProfit < 0 ? "text-red-700" : "text-muted"}>
                  분기 경상이익
                </span>
                <span
                  className={`font-mono font-bold ${
                    quarterProfit < 0 ? "text-red-700" : "text-foreground"
                  }`}
                >
                  {quarterProfit.toLocaleString("ko-KR")}원
                </span>
              </div>
              {quarterProfit < 0 && (
                <>
                  <p className="text-[11px] leading-relaxed text-red-700">
                    적자 분기입니다. 손익 게이트가 걸리면 총점과 무관하게{" "}
                    <b>등급 상한이 B</b>가 되고 성과 상여·상환 가속·출점 자격 누적이 없습니다.
                    {gated.gated && ` (${grade} → ${gated.grade})`}
                  </p>
                  <label className="flex items-center gap-2 text-[11px] text-red-700">
                    <input
                      type="checkbox"
                      name="gate_exempt"
                      checked={gateExempt}
                      onChange={(e) => setGateExempt(e.target.checked)}
                      className="h-4 w-4"
                    />
                    개점 초기 계획된 적자 · 리모델링·휴업 분기라 게이트를 면제한다
                  </label>
                </>
              )}
            </div>
          )}
        </div>

        {loadingAuto && (
          <p className="rounded-2xl border border-border bg-card p-4 text-xs text-muted">
            앱 데이터에서 자동 지표를 계산하고 있습니다...
          </p>
        )}

        {MANAGER_SECTIONS.map((section) => {
          const items = MANAGER_ITEMS.filter((i) => i.section === section.key);
          const sectionMax = items.reduce((s, i) => s + i.max, 0);
          const sectionScore = items.reduce((s, i) => s + (scores[i.id] ?? 0), 0);
          return (
            <div key={section.key} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2 border-b border-border pb-1.5">
                <span className="text-sm font-bold">{section.key}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                  {section.scorer}
                </span>
                <span className="ml-auto font-mono text-xs font-bold text-brand-dark">
                  {sectionScore} / {sectionMax}
                </span>
              </div>

              {items.map((item) => {
                const note = auto?.notes[item.id];
                const autoScored = item.auto && typeof auto?.scores[item.id] === "number";
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold">{item.name}</span>
                      <span className="ml-auto font-mono text-xs text-muted">{item.max}점</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted">{item.desc}</p>
                    {item.scale && (
                      <p className="rounded-xl bg-background p-2.5 font-mono text-[11px] leading-relaxed text-muted">
                        {item.scale}
                      </p>
                    )}

                    {item.auto && (
                      <p
                        className={`rounded-xl p-2.5 text-[11px] leading-relaxed ${
                          autoScored
                            ? "bg-brand-light text-brand-dark"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {note ?? (loadingAuto ? "계산 중..." : "데이터 없음")}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: item.max + 1 }, (_, i) => item.max - i).map((point) => {
                        const on = scores[item.id] === point;
                        const locked = !!autoScored;
                        return (
                          <button
                            key={point}
                            type="button"
                            disabled={locked}
                            onClick={() => setScores((prev) => ({ ...prev, [item.id]: point }))}
                            className={`h-10 w-10 rounded-xl border font-mono text-sm font-bold transition-colors ${
                              on
                                ? "border-brand bg-brand text-white"
                                : "border-border bg-background text-muted"
                            } ${locked && !on ? "opacity-30" : ""}`}
                          >
                            {point}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="hidden"
                      name={`score_${item.id}`}
                      value={scores[item.id] ?? ""}
                    />
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
          disabled={pending}
          className="rounded-xl bg-brand py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </form>

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

      {review?.finalized_at && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <span className="text-sm font-bold">확정됨</span>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">등급</span>
            <span
              className="font-mono text-lg font-bold"
              style={{ color: MANAGER_GRADE_COLOR[review.grade ?? "B"] }}
            >
              {review.grade} {review.total_score}
            </span>
          </div>
          {review.gate_applied && (
            <p className="rounded-xl bg-red-50 p-3 text-[11px] leading-relaxed text-red-700">
              적자 분기라 손익 게이트가 적용되어 등급 상한 B로 조정됐습니다.
            </p>
          )}
          <p className="text-xs text-muted">{managerAction(review.grade ?? "B")}</p>
        </div>
      )}
    </div>
  );
}
