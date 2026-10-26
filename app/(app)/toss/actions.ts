"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { testTossMerchant } from "@/lib/tossPlace";
import type { Database } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TossFormState = { error?: string; success?: boolean; info?: string } | undefined;

async function requireHqMaster(supabase: SupabaseClient<Database>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("role, store_id, department, status").eq("id", user.id).maybeSingle();
  return p && p.role === "owner" && !p.store_id && !p.department && p.status === "approved" ? user : null;
}

// 앱 키 저장. 가맹점이 하나라도 등록돼 있으면 그걸로 실제 호출해 키를 검증한다.
export async function saveTossKeys(_prev: TossFormState, formData: FormData): Promise<TossFormState> {
  const supabase = await createClient();
  const user = await requireHqMaster(supabase);
  if (!user) return { error: "본사 마스터 계정만 설정할 수 있어요." };

  const accessKey = String(formData.get("access_key") ?? "").trim();
  const secretIn = String(formData.get("access_secret") ?? "").trim();
  if (!accessKey) return { error: "Access Key를 입력해 주세요." };
  const { data: existing } = await supabase.from("toss_settings").select("access_secret").eq("id", 1).maybeSingle();
  const secretKey = secretIn || existing?.access_secret || "";
  if (!secretKey) return { error: "Access Secret을 입력해 주세요." };

  const { data: merchants } = await supabase.from("store_toss_merchants").select("merchant_id").limit(1);
  let info = "키를 저장했어요. 가맹점을 연결하면 실제로 확인해요.";
  if (merchants?.[0]) {
    const t = await testTossMerchant({ accessKey, secretKey }, merchants[0].merchant_id);
    if (!t.ok) return { error: `토스 연결 실패: ${t.error}` };
    info = `토스 연결 확인됨 (${t.merchant.name ?? merchants[0].merchant_id})`;
  }

  const { error } = await supabase.from("toss_settings").upsert(
    { id: 1, access_key: accessKey, access_secret: secretKey, updated_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (error) return { error: "저장에 실패했어요." };
  revalidatePath("/toss/settings");
  return { success: true, info };
}

// 매장 ↔ 가맹점 ID 저장. 키가 있으면 매장 정보 조회로 검증한다.
export async function saveTossMerchant(_prev: TossFormState, formData: FormData): Promise<TossFormState> {
  const supabase = await createClient();
  const user = await requireHqMaster(supabase);
  if (!user) return { error: "본사 마스터 계정만 설정할 수 있어요." };

  const storeId = String(formData.get("store_id") ?? "");
  const merchantId = String(formData.get("merchant_id") ?? "").trim();
  const isTest = formData.get("is_test") === "on";
  if (!storeId || !merchantId) return { error: "가맹점 ID를 입력해 주세요." };

  const { data: keys } = await supabase.from("toss_settings").select("access_key, access_secret").eq("id", 1).maybeSingle();
  let merchantName: string | null = null;
  let info = "저장했어요 (키가 없어 연결 확인은 생략).";
  if (keys) {
    const t = await testTossMerchant({ accessKey: keys.access_key, secretKey: keys.access_secret }, merchantId);
    if (!t.ok) return { error: `가맹점 확인 실패: ${t.error}` };
    merchantName = (t.merchant.name as string | undefined) ?? null;
    info = `연결 확인됨${merchantName ? ` · ${merchantName}` : ""}`;
  }

  const { error } = await supabase.from("store_toss_merchants").upsert(
    { store_id: storeId, merchant_id: merchantId, merchant_name: merchantName, is_test: isTest, updated_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: "store_id" }
  );
  if (error) return { error: "저장에 실패했어요." };
  revalidatePath("/toss/settings");
  return { success: true, info };
}

export async function deleteTossMerchant(storeId: string): Promise<void> {
  const supabase = await createClient();
  if (!(await requireHqMaster(supabase))) return;
  await supabase.from("store_toss_merchants").delete().eq("store_id", storeId);
  revalidatePath("/toss/settings");
}
