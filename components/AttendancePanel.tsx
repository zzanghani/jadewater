"use client";

import { useActionState, useState } from "react";
import { saveAttendance } from "@/app/(app)/hr/attendance/actions";
import { attendanceScore } from "@/lib/evalRubric";
import { kstDateString } from "@/lib/date";
import type { Employee, EmployeeAttendance } from "@/lib/types";

// 분기 안의 3개월을 만든다 — 지문인식 기록을 월말에 이 세 칸에 꽂는다.
function monthsOfQuarter(period: string): string[] {
  const [yearStr, qStr] = period.split("-Q");
  const year = Number(yearStr);
  const start = (Number(qStr) - 1) * 3 + 1;
  return [0, 1, 2].map((i) => `${year}-${String(start + i).padStart(2, "0")}`);
}

export default function AttendancePanel({
  employees,
  attendance,
  period,
  periodLabel,
}: {
  employees: Employee[];
  attendance: EmployeeAttendance[];
  period: string;
  periodLabel: string;
}) {
  const months = monthsOfQuarter(period);
  const thisMonth = kstDateString(0).slice(0, 7);
  const [month, setMonth] = useState(months.includes(thisMonth) ? thisMonth : months[0]);
  const [state, formAction, pending] = useActionState(saveAttendance, undefined);

  const byKey = new Map(attendance.map((a) => [`${a.employee_id}|${a.month}`, a]));
  const filledMonths = months.filter((m) => attendance.some((a) => a.month === m));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold">근태 입력</span>
          <span className="text-xs text-muted">{periodLabel}</span>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          매장 지문인식기 기록을 월말에 직원별로 넣습니다. 분기 3개월치를 합산해
          <b className="text-foreground"> 근무평가의 근태 문항이 자동으로 채점</b>됩니다.
        </p>

        <input type="hidden" name="month" value={month} />
        <div className="grid grid-cols-3 gap-2">
          {months.map((m) => {
            const filled = filledMonths.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMonth(m)}
                className={`flex flex-col items-center gap-0.5 rounded-xl border py-2.5 transition-colors ${
                  month === m
                    ? "border-brand bg-brand/10"
                    : "border-border bg-background"
                }`}
              >
                <span className="text-sm font-bold">{Number(m.slice(5))}월</span>
                <span className={`text-[10px] ${filled ? "text-brand-dark" : "text-muted"}`}>
                  {filled ? "입력됨" : "미입력"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-muted">
          <span className="flex-1">직원</span>
          <span className="w-12 text-center">지각</span>
          <span className="w-12 text-center">결근</span>
          <span className="w-12 text-center">무단</span>
          <span className="w-8 text-center">점수</span>
        </div>

        {employees.map((emp) => {
          const saved = byKey.get(`${emp.id}|${month}`);
          // 이 달만 놓고 본 점수 — 실제 평가는 분기 3개월 합산으로 낸다.
          const preview = attendanceScore({
            late: saved?.late_count ?? 0,
            absent: saved?.absent_count ?? 0,
            unauthorized: saved?.unauthorized_count ?? 0,
            months: saved ? 1 : 0,
          });
          return (
            <div key={emp.id} className="flex items-center gap-2 border-t border-border pt-2">
              <input type="hidden" name="employee_id" value={emp.id} />
              <span className="flex-1 truncate text-sm font-medium">{emp.name}</span>
              <input
                type="number"
                min={0}
                name={`late_${emp.id}`}
                defaultValue={saved?.late_count ?? 0}
                className="w-12 rounded-lg border border-border bg-background py-1.5 text-center font-mono text-sm"
              />
              <input
                type="number"
                min={0}
                name={`absent_${emp.id}`}
                defaultValue={saved?.absent_count ?? 0}
                className="w-12 rounded-lg border border-border bg-background py-1.5 text-center font-mono text-sm"
              />
              <input
                type="number"
                min={0}
                name={`unauth_${emp.id}`}
                defaultValue={saved?.unauthorized_count ?? 0}
                className="w-12 rounded-lg border border-border bg-background py-1.5 text-center font-mono text-sm"
              />
              <span className="w-8 text-center font-mono text-sm font-bold text-muted">
                {preview ?? "—"}
              </span>
            </div>
          );
        })}

        {employees.length === 0 && (
          <p className="text-xs text-muted">대상 직원이 없습니다.</p>
        )}
      </div>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.success && <p className="text-xs text-green-700">저장했습니다.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {pending ? "저장 중..." : `${Number(month.slice(5))}월 근태 저장`}
      </button>
    </form>
  );
}
