"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PaymentFormState = { error?: string; success?: boolean } | undefined;

export async function savePaymentRequest(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const storeId = String(formData.get("store_id") ?? "");
  const vendorName = String(formData.get("vendor_name") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const bankName = String(formData.get("bank_name") ?? "").trim() || null;
  const accountNumber = String(formData.get("account_number") ?? "").trim() || null;

  if (!storeId) {
    return { error: "매장을 선택해 주세요." };
  }
  if (!vendorName) {
    return { error: "거래처명을 입력해 주세요." };
  }
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    return { error: "금액을 올바르게 입력해 주세요." };
  }

  const { error } = await supabase.from("payment_requests").insert({
    store_id: storeId,
    vendor_name: vendorName,
    amount,
    bank_name: bankName,
    account_number: accountNumber,
    created_by: user.id,
  });

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/payment");
  return { success: true };
}
