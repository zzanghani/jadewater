"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReceiptCategory } from "@/lib/types";

export type ReceiptFormState = { error?: string; success?: boolean } | undefined;

const CATEGORIES: ReceiptCategory[] = ["식재료", "음료재료", "소모품", "기타"];

export async function saveReceipt(
  _prevState: ReceiptFormState,
  formData: FormData
): Promise<ReceiptFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const id = String(formData.get("id") ?? "").trim() || null;
  const date = String(formData.get("date") ?? "");
  const storeId = String(formData.get("store_id") ?? "");
  const supplier = String(formData.get("supplier") ?? "").trim();
  const items = String(formData.get("items") ?? "").trim() || null;
  const amount = Number(formData.get("amount") ?? 0);
  const category = String(formData.get("category") ?? "") as ReceiptCategory;

  if (!date) {
    return { error: "날짜를 선택해 주세요." };
  }
  if (!storeId) {
    return { error: "매장을 선택해 주세요." };
  }
  if (!supplier) {
    return { error: "거래처명을 입력해 주세요." };
  }
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    return { error: "금액을 올바르게 입력해 주세요." };
  }
  if (!CATEGORIES.includes(category)) {
    return { error: "카테고리를 선택해 주세요." };
  }

  const payload = { date, store_id: storeId, supplier, items, amount, category };

  const { error } = id
    ? await supabase.from("receipts").update(payload).eq("id", id)
    : await supabase.from("receipts").insert({ ...payload, created_by: user.id });

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/receipts");
  revalidatePath("/analysis");
  revalidatePath("/cost");
  return { success: true };
}

export type RenameSupplierResult = { error?: string } | undefined;

// "하눌식자재"처럼 오타로 따로 등록된 거래처명을 과거 입고 내역까지
// 한번에 올바른 이름으로 합친다 — 안 그러면 거래처별 매입 집계에서
// 같은 거래처가 이름 차이로 계속 따로 잡힌다.
export async function renameSupplier(
  storeId: string,
  oldName: string,
  newName: string
): Promise<RenameSupplierResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const trimmed = newName.trim();
  if (!trimmed) return { error: "새 거래처명을 입력해 주세요." };
  if (trimmed === oldName) return undefined;

  const { error } = await supabase
    .from("receipts")
    .update({ supplier: trimmed })
    .eq("store_id", storeId)
    .eq("supplier", oldName);

  if (error) {
    return { error: "수정 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/receipts");
  revalidatePath("/analysis");
  revalidatePath("/cost");
  revalidatePath("/settlement");
  return undefined;
}

export async function deleteReceipt(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("receipts").delete().eq("id", id);

  revalidatePath("/receipts");
  revalidatePath("/analysis");
  revalidatePath("/cost");
}
