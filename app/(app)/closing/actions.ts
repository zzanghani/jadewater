"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ClosingFormState = { error?: string; success?: boolean } | undefined;

const NUMBER_FIELDS = [
  "lunch_guests",
  "dinner_guests",
  "card_sales",
  "cash_sales",
  "easypay_sales",
  "discount_amount",
  "food_sales",
  "beverage_sales",
  "wine_sales",
  "rental_sales",
  "coupang_eats_sales",
  "baemin_sales",
] as const;

export async function saveClosing(
  _prevState: ClosingFormState,
  formData: FormData
): Promise<ClosingFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const date = String(formData.get("date") ?? "");
  const storeId = String(formData.get("store_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const values = Object.fromEntries(
    NUMBER_FIELDS.map((field) => [field, Number(formData.get(field) ?? 0)])
  ) as Record<(typeof NUMBER_FIELDS)[number], number>;

  if (!date) {
    return { error: "날짜를 선택해 주세요." };
  }
  if (!storeId) {
    return { error: "매장을 선택해 주세요." };
  }
  if (Object.values(values).some((n) => Number.isNaN(n) || n < 0)) {
    return { error: "숫자는 0 이상으로 입력해 주세요." };
  }

  const { error } = await supabase.from("daily_closings").upsert(
    {
      date,
      store_id: storeId,
      ...values,
      notes,
      created_by: user.id,
      updated_by: user.id,
    },
    { onConflict: "date,store_id" }
  );

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/");
  revalidatePath("/closing");
  revalidatePath("/analysis");
  revalidatePath("/cost");
  revalidatePath("/monthly-analysis");
  revalidatePath("/settlement");
  return { success: true };
}
