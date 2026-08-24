"use client";

import { useState } from "react";
import { deleteEmployee } from "@/app/(app)/hr/actions";
import { tenureLabel, healthCertStatus } from "@/lib/date";
import { roleColor } from "@/lib/scheduleColors";
import HrEmployeeForm from "@/components/HrEmployeeForm";
import type { Employee, EmployeeTeam } from "@/lib/types";

type StoreInfo = { id: string; name: string; color: string };

// 보건증 갱신 알람 3단계 — 만료 45일 전(제이드앤워터 브랜드 민트) → 30일 전(주황) →
// 15일 전(빨강)으로 갈수록 위급하게. 색은 매장 브랜드 톤을 그대로 가져와
// 이 화면이 지금 어떤 테마(베메컴 네이비)를 쓰든 항상 같은 색으로 보인다.
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

const TEAMS: EmployeeTeam[] = ["홀", "키친"];

export default function HrClient({
  stores,
  msoEmployees,
  employeesByStore,
}: {
  stores: StoreInfo[];
  msoEmployees: Employee[];
  employeesByStore: Record<string, Employee[]>;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"roster" | "review">("roster");

  const storesWithPeople = stores.filter((s) => (employeesByStore[s.id]?.length ?? 0) > 0);
  const totalCount = msoEmployees.length + storesWithPeople.reduce(
    (sum, s) => sum + (employeesByStore[s.id]?.length ?? 0),
    0
  );
  const allEmployees = [...msoEmployees, ...Object.values(employeesByStore).flat()];
  const fullTimeCount = allEmployees.filter((e) => e.employment_type === "정직원").length;
  const ptCount = totalCount - fullTimeCount;

  function renderPersonRow(emp: Employee) {
    if (editingId === emp.id) {
      return (
        <HrEmployeeForm
          key={emp.id}
          stores={stores}
          employee={emp}
          onDone={() => setEditingId(null)}
        />
      );
    }

    const certStatus = healthCertStatus(emp.health_cert_issued_at);
    const certBadge = HEALTH_CERT_BADGE[certStatus];

    return (
      <li
        key={emp.id}
        className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: roleColor(emp.position) }}
            >
              {emp.position}
            </span>
            <span className="text-sm font-semibold">{emp.name}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                emp.employment_type === "정직원"
                  ? "bg-brand-light text-brand-dark"
                  : "bg-background text-muted"
              }`}
            >
              {emp.employment_type === "정직원" ? "정직원" : "PT"}
            </span>
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
          {emp.phone && <span>{emp.phone}</span>}
          <span>입사일 {emp.hire_date}</span>
          <span>근속 {tenureLabel(emp.hire_date)}</span>
          <span className="flex items-center gap-1">
            보건증 발급 {emp.health_cert_issued_at ?? "-"}
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
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">HR</h1>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("roster")}
          className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center transition-colors ${
            activeTab === "roster" ? "border-brand bg-brand/10" : "border-border bg-card"
          }`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand">
            <PeopleIcon />
          </span>
          <span className="text-[11px] font-medium leading-tight text-foreground">HR</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("review")}
          className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center transition-colors ${
            activeTab === "review" ? "border-brand bg-brand/10" : "border-border bg-card"
          }`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand">
            <ReviewIcon />
          </span>
          <span className="text-[11px] font-medium leading-tight text-foreground">인사평가</span>
        </button>
      </div>

      {activeTab === "review" && (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">
          준비 중인 기능입니다. 자료 정리되는 대로 반영될 예정이에요.
        </p>
      )}

      {activeTab === "roster" && (
        <>
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
            <HrEmployeeForm stores={stores} onDone={() => setShowAddForm(false)} />
          )}

          {totalCount === 0 ? (
            <p className="text-sm text-muted">등록된 직원이 없습니다.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold">{totalCount}</span>
                  <span className="text-xs font-semibold text-muted">명 · 전사 인력</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex flex-1 flex-col gap-0.5 rounded-xl bg-background px-3 py-2">
                    <span className="text-base font-bold">{fullTimeCount}</span>
                    <span className="text-[11px] font-semibold text-muted">정직원</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 rounded-xl bg-background px-3 py-2">
                    <span className="text-base font-bold">{ptCount}</span>
                    <span className="text-[11px] font-semibold text-muted">파트타이머</span>
                  </div>
                </div>
              </div>

              {msoEmployees.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-xs font-bold text-foreground">MSO운영회사</span>
                    <span className="text-[11px] font-semibold text-muted">{msoEmployees.length}명</span>
                  </div>
                  <ul className="flex flex-col gap-2">{msoEmployees.map(renderPersonRow)}</ul>
                </div>
              )}

              {storesWithPeople.map((store) => {
                const people = employeesByStore[store.id] ?? [];
                return (
                  <div key={store.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-xs font-bold text-foreground">{store.name}</span>
                      <span className="text-[11px] font-semibold text-muted">{people.length}명</span>
                    </div>
                    {TEAMS.map((team) => {
                      const teamPeople = people.filter((p) => p.team === team);
                      if (teamPeople.length === 0) return null;
                      const fullCount = teamPeople.filter((p) => p.employment_type === "정직원").length;
                      const teamPtCount = teamPeople.length - fullCount;
                      return (
                        <div key={team} className="flex flex-col gap-2">
                          <span className="px-0.5 text-[11px] font-semibold text-brand-dark">
                            {team}
                            <span className="ml-1 font-medium text-muted">
                              · 정직원 {fullCount}
                              {teamPtCount > 0 ? ` · PT ${teamPtCount}` : ""}
                            </span>
                          </span>
                          <ul className="flex flex-col gap-2">{teamPeople.map(renderPersonRow)}</ul>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}

function PeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M17 8h4M19 6v4" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
      <path d="m9 11 2 2 4-4" />
    </svg>
  );
}
