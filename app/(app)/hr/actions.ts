"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ScheduleRole } from "@/lib/types";

const POSITIONS: ScheduleRole[] = ["점장", "부점장", "팀장", "사원", "파트타이머"];

export type HrFormState = { error?: string; success?: boolean } | undefined;

export async function createEmployee(
  _prevState: HrFormState,
  formData: FormData
): Promise<HrFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const storeId = String(formData.get("store_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const positionRaw = String(formData.get("position") ?? "");
  const hireDate = String(formData.get("hire_date") ?? "");
  const healthCertIssuedAt = String(formData.get("health_cert_issued_at") ?? "").trim();

  if (!storeId) return { error: "매장을 선택해 주세요." };
  if (!name) return { error: "이름을 입력해 주세요." };
  if (!POSITIONS.includes(positionRaw as ScheduleRole)) {
    return { error: "직급을 올바르게 선택해 주세요." };
  }
  if (!hireDate) return { error: "입사일자를 선택해 주세요." };

  const { error } = await supabase.from("employees").insert({
    store_id: storeId,
    name,
    position: positionRaw as ScheduleRole,
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
  const name = String(formData.get("name") ?? "").trim();
  const positionRaw = String(formData.get("position") ?? "");
  const hireDate = String(formData.get("hire_date") ?? "");
  const healthCertIssuedAt = String(formData.get("health_cert_issued_at") ?? "").trim();

  if (!id) return { error: "잘못된 요청입니다." };
  if (!name) return { error: "이름을 입력해 주세요." };
  if (!POSITIONS.includes(positionRaw as ScheduleRole)) {
    return { error: "직급을 올바르게 선택해 주세요." };
  }
  if (!hireDate) return { error: "입사일자를 선택해 주세요." };

  const { error } = await supabase
    .from("employees")
    .update({
      name,
      position: positionRaw as ScheduleRole,
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

export async function deleteEmployee(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("employees").delete().eq("id", id);
  revalidatePath("/hr");
}
