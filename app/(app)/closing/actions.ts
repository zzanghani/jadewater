"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ClosingFormState = { error?: string; success?: boolean } | undefined;

const NUMBER_FIELDS = [
  "lunch_guests",
  "dinner_guests",
  "lunch_teams",
  "dinner_teams",
  "visit_teams",
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

// ---------------------------------------------------------------------------
// 토스포스에서 그날 결제 자료를 읽어 마감입력 칸을 채운다 (객수·카테고리는 그대로 둔다).
// 지점장은 토스 키 테이블을 못 읽으니 서비스 키로 읽되, 자기 매장인지 먼저 확인한다.
// ---------------------------------------------------------------------------
import { createServiceClient } from "@/lib/supabase/service";
import { fetchTossClosing, tossClosingToForm, type TossClosing } from "@/lib/tossClosing";

export type TossClosingResult =
  | { ok: true; fields: ReturnType<typeof tossClosingToForm>; summary: TossClosing; isTest: boolean }
  | { ok: false; error: string };

export async function loadTossClosing(storeId: string, date: string): Promise<TossClosingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "날짜가 올바르지 않습니다." };

  const { data: profile } = await supabase.from("profiles").select("store_id, department, status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "approved" || profile.department || (profile.store_id && profile.store_id !== storeId)) {
    return { ok: false, error: "이 매장의 마감을 입력할 권한이 없어요." };
  }

  const service = createServiceClient();
  const [{ data: merchant }, { data: keys }] = await Promise.all([
    service.from("store_toss_merchants").select("merchant_id, is_test").eq("store_id", storeId).maybeSingle(),
    service.from("toss_settings").select("access_key, access_secret").eq("id", 1).maybeSingle(),
  ]);
  if (!merchant) return { ok: false, error: "이 매장은 아직 토스포스와 연결되지 않았어요." };
  if (!keys) return { ok: false, error: "토스 앱 키가 등록되지 않았어요. 대표님께 요청해 주세요." };

  try {
    const summary = await fetchTossClosing({ accessKey: keys.access_key, secretKey: keys.access_secret }, merchant.merchant_id, date);
    return { ok: true, fields: tossClosingToForm(summary), summary, isTest: merchant.is_test };
  } catch (e) {
    return { ok: false, error: `토스에서 읽지 못했어요: ${(e as Error).message}` };
  }
}
