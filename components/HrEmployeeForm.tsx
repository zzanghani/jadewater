"use client";

import { useActionState, useEffect, useState } from "react";
import { createEmployee, updateEmployee, type HrFormState } from "@/app/(app)/hr/actions";
import { SCHEDULE_ROLES, roleColor } from "@/lib/scheduleColors";
import { kstDateString } from "@/lib/date";
import SingleDatePicker from "@/components/SingleDatePicker";
import type { Employee, ScheduleRole } from "@/lib/types";

export default function HrEmployeeForm({
  storeId,
  employee,
  onDone,
}: {
  storeId: string;
  employee?: Employee;
  onDone?: () => void;
}) {
  const action = employee ? updateEmployee : createEmployee;
  const [state, formAction, pending] = useActionState<HrFormState, FormData>(action, undefined);
  const [position, setPosition] = useState<ScheduleRole>(employee?.position ?? SCHEDULE_ROLES[0]);
  const [hireDate, setHireDate] = useState(employee?.hire_date ?? kstDateString(0));
  const [healthCertDate, setHealthCertDate] = useState(employee?.health_cert_renewed_at ?? "");

  useEffect(() => {
    if (state?.success) onDone?.();
  }, [state, onDone]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
    >
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <input type="hidden" name="store_id" value={storeId} />
      <input type="hidden" name="position" value={position} />
      <input type="hidden" name="hire_date" value={hireDate} />
      <input type="hidden" name="health_cert_renewed_at" value={healthCertDate} />

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        이름
        <input
          type="text"
          name="name"
          required
          defaultValue={employee?.name}
          placeholder="이름을 입력하세요"
          className="rounded-xl border border-border bg-background px-4 py-2.5 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        직급
        <div className="flex flex-wrap gap-1.5">
          {SCHEDULE_ROLES.map((r) => {
            const selected = position === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setPosition(r)}
                style={selected ? { backgroundColor: roleColor(r) } : undefined}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected
                    ? "text-white shadow-sm"
                    : "border border-border bg-background text-muted"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <SingleDatePicker label="입사일자" date={hireDate} onChange={setHireDate} />

      <SingleDatePicker
        label="보건증 갱신일자 (선택)"
        date={healthCertDate}
        onChange={setHealthCertDate}
        allowClear
        placeholder="선택 안 함"
      />

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-2">
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
        >
          {pending ? "저장 중..." : employee ? "수정 저장" : "직원 추가"}
        </button>
      </div>
    </form>
  );
}
