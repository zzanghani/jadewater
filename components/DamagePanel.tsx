"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { createDamageRecord, updateDamageStatus } from "@/app/(app)/hr/attendance/actions";
import { kstDateString, kstShortDateLabel } from "@/lib/date";
import { damageDemotion } from "@/lib/evalRubric";
import type {
  DamageCategory,
  DamageRecord,
  DamageStatus,
  Employee,
} from "@/lib/types";

const CATEGORIES: DamageCategory[] = ["기물", "비품", "시설", "식자재", "기타"];
const STATUSES: DamageStatus[] = ["확인중", "처리완료", "경고", "변상"];

const STATUS_STYLE: Record<DamageStatus, string> = {
  확인중: "bg-gray-100 text-gray-600",
  처리완료: "bg-green-50 text-green-700",
  경고: "bg-orange-50 text-orange-600",
  변상: "bg-red-50 text-red-700",
};

export default function DamagePanel({
  employees,
  records,
  stores,
  periodLabel,
}: {
  employees: Employee[];
  records: DamageRecord[];
  stores: { id: string; name: string }[];
  periodLabel: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState(createDamageRecord, undefined);
  const [updating, startUpdate] = useTransition();

  const nameById = new Map(employees.map((e) => [e.id, e.name]));

  // 강등 판정 — 직원이 지정된 건만, 월별로 세어 한 달 3건 이상이면 걸린다.
  const demotions = useMemo(() => {
    const byEmployee = new Map<string, Map<string, number>>();
    for (const r of records) {
      if (!r.employee_id) continue;
      const month = r.occurred_on.slice(0, 7);
      const months = byEmployee.get(r.employee_id) ?? new Map<string, number>();
      months.set(month, (months.get(month) ?? 0) + 1);
      byEmployee.set(r.employee_id, months);
    }
    return [...byEmployee.entries()]
      .map(([employeeId, months]) => ({
        employeeId,
        ...damageDemotion([...months.values()]),
      }))
      .filter((d) => d.demote);
  }, [records]);

  const unassigned = records.filter((r) => !r.employee_id).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold">damage list</span>
          <span className="text-xs text-muted">{periodLabel}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">이번 분기 등재</span>
          <span className="font-mono font-bold">{records.length}건</span>
        </div>
        {unassigned > 0 && (
          <p className="text-xs text-muted">
            원인 미특정 {unassigned}건은 등급 판정에서 제외됩니다.
          </p>
        )}

        {demotions.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-xl bg-red-50 p-3">
            <span className="text-xs font-bold text-red-700">
              등급 1단계 강등 대상 {demotions.length}명
            </span>
            {demotions.map((d) => (
              <div key={d.employeeId} className="flex items-baseline justify-between text-xs text-red-700">
                <span className="font-bold">{nameById.get(d.employeeId) ?? "―"}</span>
                <span className="font-mono">한 달 최다 {d.worstMonth}건</span>
              </div>
            ))}
            <p className="text-[11px] leading-relaxed text-red-700">
              한 달에 3건 이상이면 근무평가 등급이 한 단계 내려갑니다. 채점 화면에서 확정할 때 반영하세요.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted">강등 대상 없음 (한 달 3건 이상 시 1단계 강등)</p>
        )}

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="self-start rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          {showForm ? "닫기" : "+ 등재"}
        </button>
      </div>

      {showForm && (
        <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">매장</span>
            <select
              name="store_id"
              defaultValue={stores[0]?.id ?? ""}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">품목명</span>
            <input
              name="item_name"
              required
              placeholder="예) 와인잔"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">구분</span>
              <select
                name="category"
                defaultValue="기물"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-24 flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">수량</span>
              <input
                type="number"
                name="quantity"
                min={1}
                defaultValue={1}
                className="rounded-xl border border-border bg-background px-3 py-2 text-center font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">
              원인 직원 (모르면 비워 둡니다)
            </span>
            <select
              name="employee_id"
              defaultValue=""
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">특정 안 됨</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">발생일</span>
              <input
                type="date"
                name="occurred_on"
                defaultValue={kstDateString(0)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">금액 (선택)</span>
              <input
                type="number"
                name="amount"
                min={0}
                placeholder="원"
                className="rounded-xl border border-border bg-background px-3 py-2 text-right font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">사유 · 상세</span>
            <textarea
              name="reason"
              rows={2}
              placeholder="예) 마감 정리 중 떨어뜨림"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
          {state?.success && <p className="text-xs text-green-700">등재했습니다.</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-brand py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {pending ? "저장 중..." : "등재"}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="text-sm font-bold">등재 내역</span>
        {records.length === 0 ? (
          <p className="text-xs text-muted">이번 분기 등재된 건이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {records.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 border-t border-border pt-3 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span className="font-mono font-semibold">
                    {kstShortDateLabel(r.occurred_on)}
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5">{r.category}</span>
                  {r.employee_id ? (
                    <span className="font-bold text-foreground">
                      {nameById.get(r.employee_id) ?? "―"}
                    </span>
                  ) : (
                    <span>원인 미특정</span>
                  )}
                  <span className={`ml-auto rounded-full px-2 py-0.5 ${STATUS_STYLE[r.status]}`}>
                    {r.status}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">
                    {r.item_name} {r.quantity > 1 && `×${r.quantity}`}
                  </span>
                  {r.amount != null && (
                    <span className="font-mono text-xs text-muted">
                      {r.amount.toLocaleString("ko-KR")}원
                    </span>
                  )}
                </div>
                {r.reason && <p className="text-xs leading-relaxed text-muted">{r.reason}</p>}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {STATUSES.filter((s) => s !== r.status).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={updating}
                      onClick={() => startUpdate(() => updateDamageStatus(r.id, s))}
                      className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
