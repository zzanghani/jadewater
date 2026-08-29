"use client";

import { useState, useTransition } from "react";
import { linkEmployeeAccount } from "@/app/(app)/hr/records/actions";
import type { Employee } from "@/lib/types";
import type { UnlinkedAccount } from "@/components/HrClient";

// 로그인 계정과 직원 명부를 이어 주는 패널.
//
// 직급은 이미 명부(employees.position)에 있으므로 여기서 새로 부여하지 않는다.
// 계정만 붙이면 직급이 따라오고, 승진하면 명부만 고치면 된다.
export default function AccountLinkPanel({
  employees,
  accounts,
  storeNameById,
}: {
  employees: Employee[];
  accounts: UnlinkedAccount[];
  storeNameById: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const unlinkedEmployees = employees.filter((e) => !e.user_id);
  const linkedCount = employees.length - unlinkedEmployees.length;

  if (accounts.length === 0 && unlinkedEmployees.length === 0) {
    return null;
  }

  function link(employeeId: string, userId: string) {
    setError(null);
    startTransition(async () => {
      const result = await linkEmployeeAccount(employeeId, userId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-baseline justify-between text-left"
      >
        <span className="text-sm font-bold">계정 연결</span>
        <span className="text-xs text-muted">
          연결됨 {linkedCount}/{employees.length}명 · {open ? "접기" : "펼치기"}
        </span>
      </button>

      <p className="text-xs leading-relaxed text-muted">
        계정이 연결돼야 부점장·팀장이 기록을 남길 수 있고, 본인이 자기 칭찬을 볼 수 있습니다.
        직급은 직원 정보에 있는 값을 그대로 씁니다.
      </p>

      {open && (
        <>
          {error && <p className="text-xs text-red-600">{error}</p>}

          {accounts.length === 0 ? (
            <p className="text-xs text-muted">연결 안 된 계정이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {accounts.map((acc) => (
                <li key={acc.id} className="flex flex-col gap-2 rounded-xl bg-background p-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{acc.name}</span>
                    <span className="text-[11px] text-muted">
                      {acc.email}
                      {acc.storeId ? ` · ${storeNameById.get(acc.storeId) ?? ""}` : " · 매장 미선택"}
                    </span>
                  </div>
                  <select
                    defaultValue=""
                    disabled={pending}
                    onChange={(e) => {
                      if (e.target.value) link(e.target.value, acc.id);
                    }}
                    className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
                  >
                    <option value="">명부에서 이 사람 고르기</option>
                    {unlinkedEmployees
                      .filter((emp) => !acc.storeId || emp.store_id === acc.storeId)
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} · {emp.position}
                          {emp.team ? ` · ${emp.team}` : ""}
                        </option>
                      ))}
                  </select>
                </li>
              ))}
            </ul>
          )}

          {unlinkedEmployees.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-xl bg-background p-3">
              <span className="text-xs font-bold">계정이 없는 직원 {unlinkedEmployees.length}명</span>
              <div className="flex flex-wrap gap-1.5">
                {unlinkedEmployees.map((emp) => (
                  <span
                    key={emp.id}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted"
                  >
                    {emp.name}
                  </span>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-muted">
                아직 앱에 가입하지 않았거나 승인 대기 중입니다. 기록 대상은 될 수 있지만
                본인은 칭찬을 볼 수 없습니다.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
