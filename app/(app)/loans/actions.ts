"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LoanFormState = { error?: string; success?: boolean } | undefined;

function readAmount(formData: FormData, key: string): number {
  const raw = String(formData.get(key) ?? "").replace(/[^\d]/g, "");
  return raw ? Number(raw) : 0;
}

// 상환액(repaid)은 여기서 안 받는다 — 상환 기록 합계가 트리거로 들어간다.
function readEntry(formData: FormData) {
  return {
    store_name: String(formData.get("store_name") ?? "").trim(),
    investor_name: String(formData.get("investor_name") ?? "").trim(),
    principal: readAmount(formData, "principal"),
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function saveLoanRepayment(
  _prev: LoanFormState,
  formData: FormData
): Promise<LoanFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const entry = readEntry(formData);
  if (!entry.store_name) return { error: "매장을 입력해 주세요." };
  if (!entry.investor_name) return { error: "투자자 이름을 입력해 주세요." };

  // 같은 매장 줄 뒤에 붙도록 그 매장의 마지막 sort_order + 1
  const { data: last } = await supabase
    .from("loan_repayments")
    .select("sort_order")
    .eq("store_name", entry.store_name)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: maxAll } = last
    ? { data: null }
    : await supabase
        .from("loan_repayments")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
  const sortOrder = last ? last.sort_order + 1 : (maxAll?.sort_order ?? 0) + 10;

  const { error } = await supabase.from("loan_repayments").insert({
    ...entry,
    sort_order: sortOrder,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };

  revalidatePath("/loans");
  return { success: true };
}

export async function updateLoanRepayment(
  _prev: LoanFormState,
  formData: FormData
): Promise<LoanFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const id = String(formData.get("id") ?? "");
  const entry = readEntry(formData);
  if (!id) return { error: "수정할 항목을 찾을 수 없습니다." };
  if (!entry.store_name) return { error: "매장을 입력해 주세요." };
  if (!entry.investor_name) return { error: "투자자 이름을 입력해 주세요." };

  const { error } = await supabase
    .from("loan_repayments")
    .update({ ...entry, updated_by: user.id })
    .eq("id", id);
  if (error) return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };

  revalidatePath("/loans");
  return { success: true };
}

export async function deleteLoanRepayment(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("loan_repayments").delete().eq("id", id);
  revalidatePath("/loans");
}

export async function addLoanRepaymentEvent(
  _prev: LoanFormState,
  formData: FormData
): Promise<LoanFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const loanId = String(formData.get("loan_id") ?? "");
  const paidOn = String(formData.get("paid_on") ?? "");
  const amount = readAmount(formData, "amount");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!loanId) return { error: "대상을 찾을 수 없습니다." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { error: "날짜를 선택해 주세요." };
  if (amount <= 0) return { error: "상환 금액을 입력해 주세요." };

  const { error } = await supabase.from("loan_repayment_events").insert({
    loan_id: loanId,
    paid_on: paidOn,
    amount,
    notes,
    created_by: user.id,
  });
  if (error) return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };

  revalidatePath("/loans");
  return { success: true };
}

export async function deleteLoanRepaymentEvent(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("loan_repayment_events").delete().eq("id", id);
  revalidatePath("/loans");
}
