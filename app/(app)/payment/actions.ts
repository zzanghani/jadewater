"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { formatWon } from "@/lib/format";
import { sendPush } from "@/lib/webpush";
import { archivePaymentRequestToDrive } from "@/lib/paymentArchive";
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

  const { data: inserted, error } = await supabase
    .from("payment_requests")
    .insert({
      store_id: storeId,
      vendor_name: vendorName,
      amount,
      bank_name: bankName,
      account_number: accountNumber,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !inserted) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/payment");

  // 알림 발송은 부가 기능이므로, 여기서 어떤 문제가 생기더라도
  // 입금요청 저장 자체는 이미 끝난 상태로 절대 실패하지 않게 한다.
  try {
    await notifyMasterOfNewRequest(supabase, inserted);
  } catch (err) {
    console.error("[savePaymentRequest] 알림 발송 중 오류", err);
  }

  return { success: true };
}

async function notifyMasterOfNewRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  inserted: { store_id: string; vendor_name: string; amount: number }
) {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .is("store_id", null);

  console.log(
    `[savePaymentRequest] 마스터 구독 ${subs?.length ?? 0}건 발견`
  );

  if (!subs?.length) return;

  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("id", inserted.store_id)
    .single();

  const payload = {
    title: "새 입금요청",
    body: `${store?.name ?? "매장"} · ${inserted.vendor_name} · ${formatWon(inserted.amount)} 입금요청이 등록됐습니다.`,
    url: "/payment?tab=confirm",
  };

  const expiredIds: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      const { expired } = await sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        payload
      );
      if (expired) expiredIds.push(s.id);
    })
  );

  if (expiredIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", expiredIds);
  }
}

export async function completePaymentRequest(id: string): Promise<void> {
  console.log(`[completePaymentRequest] 호출됨 id=${id}`);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[completePaymentRequest] 로그인 안 됨, 중단");
    return;
  }

  const { data: updated, error: updateError } = await supabase
    .from("payment_requests")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  revalidatePath("/payment");

  if (!updated) {
    console.error(
      "[completePaymentRequest] 업데이트 실패 또는 RLS 차단",
      updateError
    );
    return;
  }

  console.log(
    `[completePaymentRequest] 완료 처리됨 store_id=${updated.store_id}`
  );

  // 알림 발송은 부가 기능이므로, 여기서 어떤 문제가 생기더라도
  // 요청완료 처리 자체는 이미 끝난 상태로 절대 실패하지 않게 한다.
  try {
    await notifyStoreOfCompletion(supabase, updated);
  } catch (err) {
    console.error("[completePaymentRequest] 알림 발송 중 오류", err);
  }
}

async function notifyStoreOfCompletion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  updated: { store_id: string; vendor_name: string; amount: number }
) {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("store_id", updated.store_id);

  console.log(
    `[completePaymentRequest] store_id=${updated.store_id} 구독 ${subs?.length ?? 0}건 발견`
  );

  if (!subs?.length) return;

  const payload = {
    title: "입금요청 완료",
    body: `${updated.vendor_name} · ${formatWon(updated.amount)} 요청이 완료 처리됐습니다.`,
    url: "/payment?tab=confirm",
  };

  const expiredIds: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      const { expired } = await sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        payload
      );
      if (expired) expiredIds.push(s.id);
    })
  );

  if (expiredIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", expiredIds);
  }
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

  revalidatePath("/expense");
  return { success: true };
}

export type ArchivePaymentState = { error?: string; success?: boolean } | undefined;

// 완료된 입금요청을 구글드라이브로 옮기고 Supabase에서는 지운다 (되돌릴 수 없음).
// 마스터 계정만 할 수 있다.
export async function archivePaymentRequestAction(
  requestId: string
): Promise<ArchivePaymentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { stores } = await getStoreContext(supabase);
  if (stores.length <= 1) {
    return { error: "마스터 계정만 보관할 수 있습니다." };
  }

  try {
    await archivePaymentRequestToDrive(supabase, requestId);
  } catch (err) {
    console.error("[archivePaymentRequestAction] 드라이브 업로드 실패", err);
    return { error: "구글드라이브 업로드 중 오류가 발생했습니다." };
  }

  const { error: deleteError } = await supabase
    .from("payment_requests")
    .delete()
    .eq("id", requestId);
  if (deleteError) {
    console.error("[archivePaymentRequestAction] Supabase 삭제 실패", deleteError);
    return {
      error: "드라이브 업로드는 됐지만 Supabase에서 삭제하는 중 오류가 발생했습니다.",
    };
  }

  revalidatePath("/payment");
  return { success: true };
}
