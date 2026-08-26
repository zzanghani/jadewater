"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createEmployeeRecord,
  deleteEmployeeRecord,
  shareRecordWithEmployee,
} from "@/app/(app)/hr/records/actions";
import { evalItemsFor } from "@/lib/employeeRecords";
import { kstDateString, kstShortDateLabel } from "@/lib/date";
import type { Employee, EmployeeRecord, EmployeeRecordKind } from "@/lib/types";

// 기록을 남긴 뒤 24시간까지만 지울 수 있다(그 뒤엔 DB 정책이 막는다).
function isDeletable(record: EmployeeRecord, myUserId: string | null): boolean {
  if (!myUserId || record.created_by !== myUserId) return false;
  return Date.now() - new Date(record.created_at).getTime() <= 24 * 60 * 60 * 1000;
}

export default function EmployeeRecords({
  employees,
  records,
  quarterLabel,
  myUserId,
}: {
  employees: Employee[];
  records: EmployeeRecord[];
  quarterLabel: string;
  myUserId: string | null;
}) {
  const [kind, setKind] = useState<EmployeeRecordKind>("칭찬");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [state, formAction, pending] = useActionState(createEmployeeRecord, undefined);
  const [filterId, setFilterId] = useState<string | null>(null);

  const selected = employees.find((e) => e.id === selectedId) ?? null;

  // 최근에 기록한 사람이 앞에 오게 — 매번 긴 목록을 훑지 않아도 되게 한다.
  const orderedEmployees = useMemo(() => {
    const lastAt = new Map<string, string>();
    for (const r of records) {
      if (!lastAt.has(r.employee_id)) lastAt.set(r.employee_id, r.created_at);
    }
    return [...employees].sort((a, b) => {
      const av = lastAt.get(a.id) ?? "";
      const bv = lastAt.get(b.id) ?? "";
      if (av === bv) return a.name.localeCompare(b.name, "ko");
      return bv.localeCompare(av);
    });
  }, [employees, records]);

  const countsByEmployee = useMemo(() => {
    const map = new Map<string, { praise: number; issue: number }>();
    for (const r of records) {
      const cur = map.get(r.employee_id) ?? { praise: 0, issue: 0 };
      if (r.kind === "칭찬") cur.praise += 1;
      else cur.issue += 1;
      map.set(r.employee_id, cur);
    }
    return map;
  }, [records]);

  const praiseTotal = records.filter((r) => r.kind === "칭찬").length;
  const issueTotal = records.length - praiseTotal;
  const withRecords = new Set(records.map((r) => r.employee_id));
  const missing = employees.filter((e) => !withRecords.has(e.id));

  const visibleRecords = filterId
    ? records.filter((r) => r.employee_id === filterId)
    : records;
  const nameById = new Map(employees.map((e) => [e.id, e.name]));

  return (
    <div className="flex flex-col gap-4">
      {/* ── 기록 남기기 ─────────────────────────────── */}
      <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold">기록 남기기</span>
          <span className="text-xs text-muted">{quarterLabel}</span>
        </div>

        <input type="hidden" name="kind" value={kind} />
        <div className="grid grid-cols-2 gap-2">
          {(["칭찬", "지적"] as EmployeeRecordKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-xl border py-3 text-sm font-bold transition-colors ${
                kind === k
                  ? k === "칭찬"
                    ? "border-green-600 bg-green-50 text-green-700"
                    : "border-red-600 bg-red-50 text-red-700"
                  : "border-border bg-background text-muted"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {kind === "칭찬"
            ? "칭찬은 저장하면 본인에게 바로 보입니다."
            : "지적은 면담 때 공개하기 전까지 본인에게 보이지 않습니다."}
        </p>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted">누구</span>
          <input type="hidden" name="employee_id" value={selectedId ?? ""} />
          <div className="flex flex-wrap gap-1.5">
            {orderedEmployees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => setSelectedId(emp.id)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selectedId === emp.id
                    ? "border-brand bg-brand font-bold text-white"
                    : "border-border bg-background text-muted"
                }`}
              >
                {emp.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted">무슨 일</span>
          <textarea
            name="body"
            rows={3}
            required
            placeholder="예) 마감 인원 부족한 날 먼저 남겠다고 함"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted">
            평가 문항 분류는 저장할 때 자동으로 붙습니다.
          </p>
        </div>

        {selected && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted">
              분류 직접 고르기 (비워두면 자동)
            </span>
            <select
              name="eval_item"
              defaultValue=""
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">자동으로 붙이기</option>
              {evalItemsFor(selected.team).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        )}

        {showDate ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted">날짜</span>
            <input
              type="date"
              name="occurred_on"
              defaultValue={kstDateString(0)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDate(true)}
            className="self-start text-xs font-medium text-brand"
          >
            오늘이 아닌 날로 바꾸기
          </button>
        )}

        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        {state?.success && <p className="text-xs text-green-700">저장했습니다.</p>}

        <button
          type="submit"
          disabled={pending || !selectedId}
          className="rounded-xl bg-brand py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </form>

      {/* ── 현황 ─────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="text-sm font-bold">이번 분기 현황</span>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">전체 기록</span>
          <span className="font-mono font-bold">{records.length}건</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">칭찬 / 지적</span>
          <span className="font-mono font-bold">
            {praiseTotal} / {issueTotal}
          </span>
        </div>
        {issueTotal > praiseTotal * 2 && praiseTotal + issueTotal >= 5 && (
          <p className="rounded-xl bg-background p-3 text-xs leading-relaxed text-muted">
            지적이 칭찬보다 많이 쌓이고 있습니다. 기록이 지적 위주로 남으면 평가가 낮게 깔립니다.
            잘한 일도 같이 남겨 주세요.
          </p>
        )}
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">기록 있는 직원</span>
          <span className="font-mono font-bold">
            {employees.length - missing.length} / {employees.length}명
          </span>
        </div>
        {missing.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl bg-background p-3">
            <span className="text-xs font-bold text-foreground">
              기록이 하나도 없는 직원 {missing.length}명
            </span>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setSelectedId(emp.id)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted"
                >
                  {emp.name}
                </button>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-muted">
              이대로 분기가 끝나면 이 직원들은 기억에만 의존해 채점하게 됩니다.
            </p>
          </div>
        )}
      </div>

      {/* ── 기록 목록 ─────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold">
            {filterId ? `${nameById.get(filterId) ?? ""} 기록` : "최근 기록"}
          </span>
          {filterId && (
            <button
              type="button"
              onClick={() => setFilterId(null)}
              className="text-xs font-medium text-brand"
            >
              전체 보기
            </button>
          )}
        </div>

        {!filterId && employees.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {orderedEmployees
              .filter((e) => countsByEmployee.has(e.id))
              .map((emp) => {
                const c = countsByEmployee.get(emp.id)!;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setFilterId(emp.id)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted"
                  >
                    {emp.name} {c.praise + c.issue}
                  </button>
                );
              })}
          </div>
        )}

        {visibleRecords.length === 0 ? (
          <p className="text-xs text-muted">아직 기록이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleRecords.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-1 border-l-[3px] pl-3"
                style={{ borderColor: r.kind === "칭찬" ? "#15803d" : "#b91c1c" }}
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span className="font-mono font-semibold">
                    {kstShortDateLabel(r.occurred_on)}
                  </span>
                  <span className="font-bold text-foreground">
                    {nameById.get(r.employee_id) ?? "―"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      r.kind === "칭찬"
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {r.kind}
                  </span>
                  {r.kind === "지적" && !r.shared_with_employee && (
                    <span className="rounded-full border border-border px-2 py-0.5">
                      본인 비공개
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed">{r.body}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {r.eval_item && (
                    <span className="rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
                      {r.eval_item}
                    </span>
                  )}
                  {r.kind === "지적" && !r.shared_with_employee && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("이 기록을 본인에게 공개할까요? 면담에서 설명할 때 씁니다.")) {
                          shareRecordWithEmployee(r.id);
                        }
                      }}
                      className="text-[11px] font-medium text-brand"
                    >
                      본인에게 공개
                    </button>
                  )}
                  {isDeletable(r, myUserId) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("이 기록을 지울까요? 작성 후 24시간이 지나면 지울 수 없습니다.")) {
                          deleteEmployeeRecord(r.id);
                        }
                      }}
                      className="text-[11px] font-medium text-muted"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
