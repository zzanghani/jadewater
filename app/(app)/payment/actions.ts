"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FieldExpenseCategory, FieldExpensePaymentMethod } from "@/lib/types";

export type PaymentFormState = { error?: string; success?: boolean } | undefined;

const FIELD_EXPENSE_CATEGORIES: FieldExpenseCategory[] = [
  "식자재",
  "소모품",
  "유류비",
  "복리후생",
  "운영",
  "마케팅",
  "기타",
];

const FIELD_EXPENSE_PAYMENT_METHODS: FieldExpensePaymentMethod[] = [
  "법인카드",
  "현금",
  "자동이체",
];

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

export async function saveFieldExpense(
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
  const date = String(formData.get("date") ?? "");
  const categoryRaw = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const paymentMethodRaw = String(formData.get("payment_method") ?? "");
  const photo = formData.get("receipt_photo");

  if (!storeId) {
    return { error: "매장을 선택해 주세요." };
  }
  if (!date) {
    return { error: "일자를 선택해 주세요." };
  }
  if (!description) {
    return { error: "구매내역을 입력해 주세요." };
  }
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    return { error: "금액을 올바르게 입력해 주세요." };
  }
  if (!FIELD_EXPENSE_CATEGORIES.includes(categoryRaw as FieldExpenseCategory)) {
    return { error: "대분류를 올바르게 선택해 주세요." };
  }
  if (
    !FIELD_EXPENSE_PAYMENT_METHODS.includes(
      paymentMethodRaw as FieldExpensePaymentMethod
    )
  ) {
    return { error: "결제수단을 올바르게 선택해 주세요." };
  }
  const category = categoryRaw as FieldExpenseCategory;
  const paymentMethod = paymentMethodRaw as FieldExpensePaymentMethod;

  let receiptPhotoPath: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    const ext = photo.name.split(".").pop() || "jpg";
    const path = `${storeId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(path, photo, { contentType: photo.type || "image/jpeg" });

    if (uploadError) {
      return { error: "영수증 사진 업로드 중 오류가 발생했습니다." };
    }
    receiptPhotoPath = path;
  }

  const { error } = await supabase.from("field_expenses").insert({
    store_id: storeId,
    date,
    category,
    description,
    amount,
    payment_method: paymentMethod,
    receipt_photo_path: receiptPhotoPath,
    created_by: user.id,
  });

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/payment");
  return { success: true };
}
