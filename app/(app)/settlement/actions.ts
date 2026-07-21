"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LaborItem, LineItem, UtilityItem } from "@/lib/types";

export type SettlementFormState = { error?: string; success?: boolean } | undefined;

const SETTLEMENT_PASSWORD = "Jadewater0609!";

export type UnlockFormState = { error?: string; success?: boolean } | undefined;

export async function unlockSettlement(
  _prevState: UnlockFormState,
  formData: FormData
): Promise<UnlockFormState> {
  const password = String(formData.get("password") ?? "");

  if (password !== SETTLEMENT_PASSWORD) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }

  return { success: true };
}

function parseItems<T>(formData: FormData, field: string): T[] {
  const raw = String(formData.get(field) ?? "[]");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSettlement(
  _prevState: SettlementFormState,
  formData: FormData
): Promise<SettlementFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const storeId = String(formData.get("store_id") ?? "");
  const month = String(formData.get("month") ?? "");
  const managerName = String(formData.get("manager_name") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!storeId) {
    return { error: "매장을 선택해 주세요." };
  }
  if (!month) {
    return { error: "정산 월을 선택해 주세요." };
  }

  const laborItems = parseItems<LaborItem>(formData, "labor_items_json").filter(
    (item) => item.name.trim() && item.amount > 0
  );
  const utilityItems = parseItems<UtilityItem>(formData, "utility_items_json").filter(
    (item) => item.amount > 0
  );
  const hqFeeItems = parseItems<LineItem>(formData, "hq_fee_items_json").filter(
    (item) => item.name.trim() && item.amount > 0
  );

  const numberFields = [
    "pension_reserve",
    "vat_reserve",
    "corp_tax_reserve",
    "reserve_carryover",
    "reserve_deduction",
    "discount_amount",
  ] as const;

  const values = Object.fromEntries(
    numberFields.map((field) => [field, Number(formData.get(field) ?? 0)])
  ) as Record<(typeof numberFields)[number], number>;

  if (Object.values(values).some((n) => Number.isNaN(n) || n < 0)) {
    return { error: "숫자는 0 이상으로 입력해 주세요." };
  }

  const { error } = await supabase.from("monthly_settlements").upsert(
    {
      store_id: storeId,
      month,
      manager_name: managerName,
      labor_items: laborItems,
      utility_items: utilityItems,
      hq_fee_items: hqFeeItems,
      ...values,
      notes,
      created_by: user.id,
      updated_by: user.id,
    },
    { onConflict: "store_id,month" }
  );

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/settlement");
  return { success: true };
}
