"use client";

import { useState } from "react";
import { resignEmployee, restoreEmployee } from "@/app/(app)/hr/actions";
import { tenureLabel, healthCertStatus, healthCertExpiry } from "@/lib/date";
import { roleColor } from "@/lib/scheduleColors";
import HrEmployeeForm from "@/components/HrEmployeeForm";
import EmployeeRecords from "@/components/EmployeeRecords";
import AccountLinkPanel from "@/components/AccountLinkPanel";
import EvalPanel from "@/components/EvalPanel";
import AttendancePanel from "@/components/AttendancePanel";
import DamagePanel from "@/components/DamagePanel";
import ManagerEvalPanel from "@/components/ManagerEvalPanel";
import type {
  DamageRecord,
  Employee,
  EmployeeAttendance,
  EmployeeRecord,
  EmployeeTeam,
  ManagerReview,
  PerformanceReview,
} from "@/lib/types";

export type UnlinkedAccount = { id: string; name: string; email: string; storeId: string | null };

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
  resignedEmployees,
  canManageMso,
  records,
  quarterLabel,
  unlinkedAccounts,
  myUserId,
  period,
  reviews,
  attendance,
  damages,
  managerReviews,
  isHrTeam,
}: {
  stores: StoreInfo[];
  msoEmployees: Employee[];
  employeesByStore: Record<string, Employee[]>;
  resignedEmployees: Employee[];
  canManageMso: boolean;
  records: EmployeeRecord[];
  quarterLabel: string;
  unlinkedAccounts: UnlinkedAccount[];
  myUserId: string | null;
  period: string;
  reviews: PerformanceReview[];
  attendance: EmployeeAttendance[];
  damages: DamageRecord[];
  managerReviews: ManagerReview[];
  // 점장 평가는 대표·운영팀·R&D팀장만 채점한다. 지점장 계정에는 탭 자체를 숨긴다.
  isHrTeam: boolean;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showResigned, setShowResigned] = useState(false);
  const [activeTab, setActiveTab] = useState<"roster" | "review">("roster");
  // 인사평가 탭 안에서 "평가 채점"과 "사건 기록"을 나눈다 — 기록은 매일,
  // 채점은 분기 말에만 쓰는 화면이라 섞어 놓으면 둘 다 찾기 힘들다.
  const [reviewTab, setReviewTab] = useState<"eval" | "manager" | "records" | "attendance" | "damage">("eval");

  const storesWithPeople = stores.filter((s) => (employeesByStore[s.id]?.length ?? 0) > 0);
  const totalCount = msoEmployees.length + storesWithPeople.reduce(
    (sum, s) => sum + (employeesByStore[s.id]?.length ?? 0),
    0
  );
  const allEmployees = [...msoEmployees, ...Object.values(employeesByStore).flat()];
  const fullTimeCount = allEmployees.filter((e) => e.employment_type === "정직원").length;
  const ptCount = totalCount - fullTimeCount;
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  const detailEmployee =
    [...allEmployees, ...resignedEmployees].find((e) => e.id === detailId) ?? null;
  const isResignedDetail = !!detailEmployee?.resigned_at;

  function renderPersonRow(emp: Employee) {
    if (editingId === emp.id) {
      return (
        <HrEmployeeForm
          key={emp.id}
          stores={stores}
          employee={emp}
          canManageMso={canManageMso}
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
          <button
            type="button"
            onClick={() => setDetailId(emp.id)}
            className="flex flex-1 flex-wrap items-center gap-2 text-left"
          >
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
          </button>
          <div className="flex shrink-0 items-center gap-3 text-xs">
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
                if (confirm(`${emp.name}님을 퇴사 처리할까요?`)) resignEmployee(emp.id);
              }}
              className="font-medium text-muted"
            >
              퇴사 처리
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
        <>
          <AccountLinkPanel
            employees={allEmployees}
            accounts={unlinkedAccounts}
            storeNameById={storeNameById}
          />

          <div className="flex gap-2">
            {([
              ["eval", "직원 평가"],
              ...(isHrTeam ? ([["manager", "점장 평가"]] as const) : []),
              ["records", `기록 ${records.length}`],
              ["attendance", "근태"],
              ["damage", `damage ${damages.length}`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setReviewTab(key)}
                className={`flex-1 rounded-xl border px-1 py-2.5 text-xs font-semibold transition-colors ${
                  reviewTab === key
                    ? "border-brand bg-brand/10 text-foreground"
                    : "border-border bg-card text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {reviewTab === "eval" && (
            <EvalPanel
              employees={allEmployees}
              reviews={reviews}
              records={records}
              attendance={attendance}
              damages={damages}
              period={period}
              periodLabel={quarterLabel}
            />
          )}
          {reviewTab === "manager" && isHrTeam && (
            // 부점장은 직원 평가표(1~5점)로 채점하므로 여기 대상이 아니다.
            <ManagerEvalPanel
              managers={allEmployees.filter((e) => e.position === "점장" && e.store_id)}
              reviews={managerReviews}
              period={period}
              periodLabel={quarterLabel}
              storeNameById={storeNameById}
            />
          )}
          {reviewTab === "records" && (
            <EmployeeRecords
              employees={allEmployees}
              records={records}
              quarterLabel={quarterLabel}
              myUserId={myUserId}
            />
          )}
          {reviewTab === "attendance" && (
            <AttendancePanel
              employees={allEmployees}
              attendance={attendance}
              period={period}
              periodLabel={quarterLabel}
            />
          )}
          {reviewTab === "damage" && (
            <DamagePanel
              employees={allEmployees}
              records={damages}
              stores={stores}
              periodLabel={quarterLabel}
            />
          )}
        </>
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
            <HrEmployeeForm
              stores={stores}
              canManageMso={canManageMso}
              onDone={() => setShowAddForm(false)}
            />
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

          {resignedEmployees.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setShowResigned((v) => !v)}
                className="self-start text-xs font-semibold text-muted"
              >
                퇴사자 목록 ({resignedEmployees.length}) {showResigned ? "▲" : "▼"}
              </button>
              {showResigned && (
                <ul className="flex flex-col gap-2">
                  {resignedEmployees.map((emp) => (
                    <li
                      key={emp.id}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4"
                    >
                      <button
                        type="button"
                        onClick={() => setDetailId(emp.id)}
                        className="flex flex-1 flex-wrap items-center gap-2 text-left"
                      >
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                          style={{ backgroundColor: roleColor(emp.position) }}
                        >
                          {emp.position}
                        </span>
                        <span className="text-sm font-semibold text-muted">{emp.name}</span>
                        <span className="text-[11px] text-muted">퇴사일 {emp.resigned_at}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`${emp.name}님을 다시 재직 상태로 되돌릴까요?`)) {
                            restoreEmployee(emp.id);
                          }
                        }}
                        className="shrink-0 text-xs font-medium text-brand"
                      >
                        복귀 처리
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {detailEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setDetailId(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-y-auto rounded-t-2xl bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">직원 상세</span>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="text-lg text-muted"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-border bg-background p-5 text-center">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
                style={{ backgroundColor: roleColor(detailEmployee.position) }}
              >
                {detailEmployee.name.slice(0, 1)}
              </span>
              <span className="text-base font-bold">{detailEmployee.name}</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: roleColor(detailEmployee.position) }}
                >
                  {detailEmployee.position}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    detailEmployee.employment_type === "정직원"
                      ? "bg-brand-light text-brand-dark"
                      : "bg-card text-muted"
                  }`}
                >
                  {detailEmployee.employment_type === "정직원" ? "정직원" : "파트타이머(PT)"}
                </span>
              </div>
              <span className="text-xs font-medium text-muted">
                {detailEmployee.department
                  ? `MSO운영회사 · ${detailEmployee.department}`
                  : `${storeNameById.get(detailEmployee.store_id ?? "") ?? "매장"} · ${detailEmployee.team ?? ""}`}
              </span>
            </div>

            <div className="mt-3 flex flex-col divide-y divide-border rounded-2xl border border-border bg-background px-4">
              <DetailRow label="전화번호" value={detailEmployee.phone} />
              <DetailRow label="이메일" value={detailEmployee.email} />
              <DetailRow label="주소" value={detailEmployee.address} />
              <DetailRow label="생일" value={detailEmployee.birthday} />
              <DetailRow label="입사일" value={detailEmployee.hire_date} />
              <DetailRow label="근속기간" value={tenureLabel(detailEmployee.hire_date)} />
              <div className="flex items-center justify-between gap-2 py-3">
                <span className="text-xs font-semibold text-muted">보건증 만료일</span>
                <HealthCertDetail issuedAt={detailEmployee.health_cert_issued_at} />
              </div>
              {isResignedDetail && <DetailRow label="퇴사일" value={detailEmployee.resigned_at} />}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingId(detailEmployee.id);
                  setDetailId(null);
                }}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted"
              >
                정보 수정
              </button>
              {isResignedDetail ? (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`${detailEmployee.name}님을 다시 재직 상태로 되돌릴까요?`)) {
                      restoreEmployee(detailEmployee.id);
                      setDetailId(null);
                    }
                  }}
                  className="flex-1 rounded-xl border border-brand/30 py-3 text-sm font-semibold text-brand"
                >
                  복귀 처리
                </button>
              ) : (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`${detailEmployee.name}님을 퇴사 처리할까요?`)) {
                    resignEmployee(detailEmployee.id);
                    setDetailId(null);
                  }
                }}
                className="flex-1 rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-600"
              >
                퇴사 처리
              </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2 py-3">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="truncate text-sm font-medium text-foreground">{value || "-"}</span>
    </div>
  );
}

function HealthCertDetail({ issuedAt }: { issuedAt: string | null }) {
  const status = healthCertStatus(issuedAt);
  const expiry = healthCertExpiry(issuedAt);

  if (!expiry) {
    return <span className="text-sm font-medium text-foreground">미등록</span>;
  }

  // "ok"는 HEALTH_CERT_BADGE에 뱃지가 없어서(목록 화면에선 여유 있으면 안
  // 보여줌), 상세 화면에서만 별도로 브랜드색 "여유" 뱃지를 채워 보여준다.
  const badge = HEALTH_CERT_BADGE[status] ?? {
    label: "여유",
    style: { backgroundColor: `${JADEWATER_BRAND}1A`, color: JADEWATER_BRAND },
  };
  const daysLeft = Math.max(expiry.daysLeft, 0);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-medium text-foreground">{expiry.dueDate}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${badge.className ?? ""}`}
        style={badge.style}
      >
        {status === "ok" ? "여유" : `D-${daysLeft}`}
      </span>
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
