"use client";

import { useActionState, useEffect, useState } from "react";
import { createEmployee, updateEmployee, type HrFormState } from "@/app/(app)/hr/actions";
import { SCHEDULE_ROLES, roleColor } from "@/lib/scheduleColors";
import { kstDateString } from "@/lib/date";
import SingleDatePicker from "@/components/SingleDatePicker";
import { EMPLOYEE_DEPARTMENTS } from "@/lib/types";
import type { Employee, EmployeeDepartment, EmployeeTeam, EmploymentType, ScheduleRole } from "@/lib/types";

type StoreInfo = { id: string; name: string };
type Affiliation = "store" | "mso";
const TEAMS: EmployeeTeam[] = ["홀", "키친"];
const EMPLOYMENT_TYPES: EmploymentType[] = ["정직원", "PT"];

export default function HrEmployeeForm({
  stores,
  employee,
  onDone,
}: {
  stores: StoreInfo[];
  employee?: Employee;
  onDone?: () => void;
}) {
  const action = employee ? updateEmployee : createEmployee;
  const [state, formAction, pending] = useActionState<HrFormState, FormData>(action, undefined);

  const [affiliation, setAffiliation] = useState<Affiliation>(
    employee?.department ? "mso" : "store"
  );
  const [storeId, setStoreId] = useState(employee?.store_id ?? stores[0]?.id ?? "");
  const [team, setTeam] = useState<EmployeeTeam>(employee?.team ?? TEAMS[0]);
  const [department, setDepartment] = useState<EmployeeDepartment>(
    employee?.department ?? EMPLOYEE_DEPARTMENTS[0]
  );
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    employee?.employment_type ?? "정직원"
  );
  const [position, setPosition] = useState<ScheduleRole>(employee?.position ?? SCHEDULE_ROLES[0]);
  const [hireDate, setHireDate] = useState(employee?.hire_date ?? kstDateString(0));
  const [healthCertDate, setHealthCertDate] = useState(employee?.health_cert_issued_at ?? "");
  const [birthday, setBirthday] = useState(employee?.birthday ?? "");

  useEffect(() => {
    if (state?.success) onDone?.();
  }, [state, onDone]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
    >
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <input type="hidden" name="affiliation" value={affiliation} />
      <input type="hidden" name="store_id" value={affiliation === "store" ? storeId : ""} />
      <input type="hidden" name="team" value={affiliation === "store" ? team : ""} />
      <input type="hidden" name="department" value={affiliation === "mso" ? department : ""} />
      <input type="hidden" name="employment_type" value={employmentType} />
      <input type="hidden" name="position" value={position} />
      <input type="hidden" name="hire_date" value={hireDate} />
      <input type="hidden" name="health_cert_issued_at" value={healthCertDate} />
      <input type="hidden" name="birthday" value={birthday} />

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        소속 구분
        <div className="flex gap-1.5 rounded-lg border border-border bg-background p-1">
          {(["mso", "store"] as Affiliation[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAffiliation(a)}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                affiliation === a ? "bg-brand text-white" : "text-muted"
              }`}
            >
              {a === "mso" ? "MSO운영회사" : "매장"}
            </button>
          ))}
        </div>
      </div>

      {affiliation === "store" ? (
        <>
          <label className="relative flex flex-col gap-1.5 text-sm font-medium">
            매장
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-brand/30 focus:ring-2"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5 text-sm font-medium">
            팀
            <div className="flex flex-wrap gap-1.5">
              {TEAMS.map((t) => {
                const selected = team === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTeam(t)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selected
                        ? "bg-brand text-white shadow-sm"
                        : "border border-border bg-background text-muted"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          소속 부서
          <div className="flex flex-wrap gap-1.5">
            {EMPLOYEE_DEPARTMENTS.map((d) => {
              const selected = department === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDepartment(d)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selected
                      ? "bg-brand text-white shadow-sm"
                      : "border border-border bg-background text-muted"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        고용형태
        <div className="flex flex-wrap gap-1.5">
          {EMPLOYMENT_TYPES.map((t) => {
            const selected = employmentType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setEmploymentType(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected
                    ? "bg-brand text-white shadow-sm"
                    : "border border-border bg-background text-muted"
                }`}
              >
                {t === "정직원" ? "정직원" : "파트타이머(PT)"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-border" />

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

      <div className="h-px bg-border" />

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        전화번호
        <input
          type="tel"
          name="phone"
          defaultValue={employee?.phone ?? ""}
          placeholder="010-0000-0000"
          className="rounded-xl border border-border bg-background px-4 py-2.5 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        이메일
        <input
          type="email"
          name="email"
          defaultValue={employee?.email ?? ""}
          placeholder="example@gmail.com"
          className="rounded-xl border border-border bg-background px-4 py-2.5 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        주소
        <input
          type="text"
          name="address"
          defaultValue={employee?.address ?? ""}
          placeholder="거주지 주소를 입력하세요"
          className="rounded-xl border border-border bg-background px-4 py-2.5 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <SingleDatePicker
        label="생일"
        date={birthday}
        onChange={setBirthday}
        allowClear
        placeholder="선택 안 함"
      />

      <div className="h-px bg-border" />

      <SingleDatePicker label="입사일자" date={hireDate} onChange={setHireDate} />

      <SingleDatePicker
        label="보건증 발급일자 (선택)"
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
