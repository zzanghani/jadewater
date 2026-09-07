"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { shiftMonthString } from "@/lib/date";
import type { PayrollPosition } from "@/lib/types";

export type PayrollFormState = { error?: string; success?: boolean } | undefined;

const POSITIONS: PayrollPosition[] = ["점장", "부점장", "팀장", "사원", "파트타이머"];

function readAmount(formData: FormData, key: string): number {
  const raw = String(formData.get(key) ?? "").replace(/[^\d]/g, "");
  return raw ? Number(raw) : 0;
}

function readMonth(formData: FormData): string | null {
  const month = String(formData.get("month") ?? "");
  return /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : null;
}

function readEntry(formData: FormData) {
  const employeeName = String(formData.get("employee_name") ?? "").trim();
  const positionRaw = String(formData.get("position") ?? "");
  const position = POSITIONS.includes(positionRaw as PayrollPosition)
    ? (positionRaw as PayrollPosition)
    : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  return {
    employee_name: employeeName,
    position,
    base_pay: readAmount(formData, "base_pay"),
    bonus: readAmount(formData, "bonus"),
    extra_pay: readAmount(formData, "extra_pay"),
    notes,
  };
}

export async function savePayrollEntry(
  _prevState: PayrollFormState,
  formData: FormData
): Promise<PayrollFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const storeId = String(formData.get("store_id") ?? "");
  const month = readMonth(formData);
  const entry = readEntry(formData);

  if (!storeId) return { error: "매장을 선택해 주세요." };
  if (!month) return { error: "월이 올바르지 않습니다." };
  if (!entry.employee_name) return { error: "이름을 입력해 주세요." };

  const { error } = await supabase.from("payroll_entries").insert({
    store_id: storeId,
    month,
    ...entry,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/payroll");
  return { success: true };
}

export async function updatePayrollEntry(
  _prevState: PayrollFormState,
  formData: FormData
): Promise<PayrollFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const id = String(formData.get("id") ?? "");
  const entry = readEntry(formData);
  if (!id) return { error: "수정할 항목을 찾을 수 없습니다." };
  if (!entry.employee_name) return { error: "이름을 입력해 주세요." };

  const { error } = await supabase
    .from("payroll_entries")
    .update({ ...entry, updated_by: user.id })
    .eq("id", id);

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/payroll");
  return { success: true };
}

export async function deletePayrollEntry(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("payroll_entries").delete().eq("id", id);
  revalidatePath("/payroll");
}

// 지난달 명단(이름·직급·기본급)을 이번 달로 복사한다. 상여·수당은 달마다
// 달라서 0으로 두고, 이미 이번 달에 내역이 있으면 아무것도 안 한다.
export async function copyPreviousMonthPayroll(
  storeId: string,
  month: string
): Promise<{ error?: string; copied?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "월이 올바르지 않습니다." };

  const thisMonth = `${month}-01`;
  const prevMonth = `${shiftMonthString(month, -1)}-01`;

  const [{ count: existing }, { data: prevRows }] = await Promise.all([
    supabase
      .from("payroll_entries")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("month", thisMonth),
    supabase
      .from("payroll_entries")
      .select("employee_name, position, base_pay")
      .eq("store_id", storeId)
      .eq("month", prevMonth)
      .order("created_at"),
  ]);

  if ((existing ?? 0) > 0) return { error: "이번 달에 이미 내역이 있어요." };
  if (!prevRows?.length) return { error: "지난달 내역이 없어요." };

  const { error } = await supabase.from("payroll_entries").insert(
    prevRows.map((r) => ({
      store_id: storeId,
      month: thisMonth,
      employee_name: r.employee_name,
      position: r.position,
      base_pay: r.base_pay,
      created_by: user.id,
      updated_by: user.id,
    }))
  );

  if (error) return { error: "복사 중 오류가 발생했습니다." };

  revalidatePath("/payroll");
  return { copied: prevRows.length };
}
