"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { kstDateString } from "@/lib/date";
import { EMPLOYEE_DEPARTMENTS } from "@/lib/types";
import type { EmployeeDepartment, EmployeeTeam, EmploymentType, ScheduleRole } from "@/lib/types";

const POSITIONS: ScheduleRole[] = ["점장", "부점장", "팀장", "사원", "파트타이머"];
const TEAMS: EmployeeTeam[] = ["홀", "키친"];
const EMPLOYMENT_TYPES: EmploymentType[] = ["정직원", "PT"];

export type HrFormState = { error?: string; success?: boolean } | undefined;

// 소속(매장 vs MSO운영회사)에 따라 store_id/department 중 하나만 채워야
// 하고, team(홀/키친)은 매장 소속일 때만 의미가 있다 — 폼에서 넘어온
// 값을 실제 저장할 형태로 정리한다.
function parseAffiliation(formData: FormData):
  | { error: string }
  | { storeId: string | null; department: EmployeeDepartment | null; team: EmployeeTeam | null } {
  const affiliation = String(formData.get("affiliation") ?? "");
  if (affiliation === "store") {
    const storeId = String(formData.get("store_id") ?? "");
    if (!storeId) return { error: "매장을 선택해 주세요." };
    const teamRaw = String(formData.get("team") ?? "");
    if (!TEAMS.includes(teamRaw as EmployeeTeam)) {
      return { error: "팀(홀/키친)을 선택해 주세요." };
    }
    return { storeId, department: null, team: teamRaw as EmployeeTeam };
  }
  if (affiliation === "mso") {
    const departmentRaw = String(formData.get("department") ?? "");
    if (!EMPLOYEE_DEPARTMENTS.includes(departmentRaw as EmployeeDepartment)) {
      return { error: "소속 부서를 선택해 주세요." };
    }
    return { storeId: null, department: departmentRaw as EmployeeDepartment, team: null };
  }
  return { error: "소속 구분을 선택해 주세요." };
}

export async function createEmployee(
  _prevState: HrFormState,
  formData: FormData
): Promise<HrFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const affiliation = parseAffiliation(formData);
  if ("error" in affiliation) return { error: affiliation.error };

  const name = String(formData.get("name") ?? "").trim();
  const positionRaw = String(formData.get("position") ?? "");
  const employmentTypeRaw = String(formData.get("employment_type") ?? "");
  const hireDate = String(formData.get("hire_date") ?? "");
  const healthCertIssuedAt = String(formData.get("health_cert_issued_at") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();

  if (!name) return { error: "이름을 입력해 주세요." };
  if (!POSITIONS.includes(positionRaw as ScheduleRole)) {
    return { error: "직급을 올바르게 선택해 주세요." };
  }
  if (!EMPLOYMENT_TYPES.includes(employmentTypeRaw as EmploymentType)) {
    return { error: "고용형태를 선택해 주세요." };
  }
  if (!hireDate) return { error: "입사일자를 선택해 주세요." };

  const { error } = await supabase.from("employees").insert({
    store_id: affiliation.storeId,
    department: affiliation.department,
    team: affiliation.team,
    employment_type: employmentTypeRaw as EmploymentType,
    name,
    position: positionRaw as ScheduleRole,
    phone: phone || null,
    email: email || null,
    address: address || null,
    birthday: birthday || null,
    hire_date: hireDate,
    health_cert_issued_at: healthCertIssuedAt || null,
    created_by: user.id,
  });

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/hr");
  return { success: true };
}

export async function updateEmployee(
  _prevState: HrFormState,
  formData: FormData
): Promise<HrFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const affiliation = parseAffiliation(formData);
  if ("error" in affiliation) return { error: affiliation.error };

  const name = String(formData.get("name") ?? "").trim();
  const positionRaw = String(formData.get("position") ?? "");
  const employmentTypeRaw = String(formData.get("employment_type") ?? "");
  const hireDate = String(formData.get("hire_date") ?? "");
  const healthCertIssuedAt = String(formData.get("health_cert_issued_at") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();

  if (!name) return { error: "이름을 입력해 주세요." };
  if (!POSITIONS.includes(positionRaw as ScheduleRole)) {
    return { error: "직급을 올바르게 선택해 주세요." };
  }
  if (!EMPLOYMENT_TYPES.includes(employmentTypeRaw as EmploymentType)) {
    return { error: "고용형태를 선택해 주세요." };
  }
  if (!hireDate) return { error: "입사일자를 선택해 주세요." };

  const { error } = await supabase
    .from("employees")
    .update({
      store_id: affiliation.storeId,
      department: affiliation.department,
      team: affiliation.team,
      employment_type: employmentTypeRaw as EmploymentType,
      name,
      position: positionRaw as ScheduleRole,
      phone: phone || null,
      email: email || null,
      address: address || null,
      birthday: birthday || null,
      hire_date: hireDate,
      health_cert_issued_at: healthCertIssuedAt || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { error: "수정 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/hr");
  return { success: true };
}

// 완전 삭제 대신 퇴사 처리 — 입사일/근속 등 기록은 남기고 재직 목록에서만
// 빠지게 한다(나중에 이력 조회가 필요할 수 있어서).
export async function resignEmployee(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("employees")
    .update({ resigned_at: kstDateString(0) })
    .eq("id", id);
  revalidatePath("/hr");
}

// 퇴사 처리를 잘못 눌렀을 때 되돌리는 용도.
export async function restoreEmployee(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("employees").update({ resigned_at: null }).eq("id", id);
  revalidatePath("/hr");
}
