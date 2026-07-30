"use client";

import { useState } from "react";
import { deleteEmployee } from "@/app/(app)/hr/actions";
import { tenureLabel, healthCertStatus } from "@/lib/date";
import { roleColor } from "@/lib/scheduleColors";
import HrEmployeeForm from "@/components/HrEmployeeForm";
import type { Employee } from "@/lib/types";

type StoreInfo = { id: string; name: string; color: string };

// 보건증 갱신 알람 3단계 — 만료 45일 전(제이드앤워터 브랜드 민트) → 30일 전(주황) →
// 15일 전(빨강)으로 갈수록 위급하게. 색은 매장 브랜드 톤을 그대로 가져와
// 이 페이지가 지금 어떤 테마(베메컴 네이비)를 쓰든 항상 같은 색으로 보인다.
const JADEWATER_BRAND = "#86c1ae";

const HEALTH_CERT_BADGE: Record<
  ReturnType<typeof healthCertStatus>,
  { label: string; className?: string; style?: { backgroundColor: string; color: string } } | null
> = {
  none: { label: "미등록", className: "bg-gray-100 text-gray-500" },
  ok: null,
  d45: {
    label: "보건증갱신",
    style: { backgroundColor: `${JADEWATER_BRAND}1A`, color: JADEWATER_BRAND },
  },
  d30: { label: "보건증갱신", className: "bg-orange-50 text-orange-600" },
  d15: { label: "보건증갱신", className: "bg-red-50 text-red-600" },
};

export default function HrClient({
  stores,
  employeesByStore,
}: {
  stores: StoreInfo[];
  employeesByStore: Record<string, Employee[]>;
}) {
  const [selectedStoreId, setSelectedStoreId] = useState(stores[0]?.id ?? "");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const employees = employeesByStore[selectedStoreId] ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">HR</h1>

      {stores.length > 1 && (
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute left-3 text-xs font-medium text-muted">
            매장
          </span>
          <select
            value={selectedStoreId}
            onChange={(e) => {
              setSelectedStoreId(e.target.value);
              setShowAddForm(false);
              setEditingId(null);
            }}
            className="w-full appearance-none rounded-xl border border-border bg-card py-2.5 pl-12 pr-8 text-sm font-semibold text-foreground outline-none ring-brand/30 focus:ring-2"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 text-muted"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </label>
      )}

      {!showAddForm && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="self-start rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand/30"
        >
          + 직원 추가
        </button>
      )}

      {showAddForm && (
        <HrEmployeeForm storeId={selectedStoreId} onDone={() => setShowAddForm(false)} />
      )}

      {employees.length === 0 ? (
        <p className="text-sm text-muted">등록된 직원이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {employees.map((emp) => {
            if (editingId === emp.id) {
              return (
                <li key={emp.id}>
                  <HrEmployeeForm
                    storeId={selectedStoreId}
                    employee={emp}
                    onDone={() => setEditingId(null)}
                  />
                </li>
              );
            }

            const certStatus = healthCertStatus(emp.health_cert_renewed_at);
            const certBadge = HEALTH_CERT_BADGE[certStatus];

            return (
              <li
                key={emp.id}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: roleColor(emp.position) }}
                    >
                      {emp.position}
                    </span>
                    <span className="text-sm font-semibold">{emp.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditingId(emp.id)}
                      className="font-medium text-brand"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`${emp.name}님을 삭제할까요?`)) deleteEmployee(emp.id);
                      }}
                      className="font-medium text-muted"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>입사일 {emp.hire_date}</span>
                  <span>근속 {tenureLabel(emp.hire_date)}</span>
                  <span className="flex items-center gap-1">
                    보건증 {emp.health_cert_renewed_at ?? "-"}
                    {certBadge && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 font-semibold ${certBadge.className ?? ""}`}
                        style={certBadge.style}
                      >
                        {certBadge.label}
                      </span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
