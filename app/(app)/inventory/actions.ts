"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { InventorySection } from "@/lib/types";

export type InventoryFormState = { error?: string; success?: boolean } | undefined;

const SECTIONS: InventorySection[] = ["홀", "주방"];

export async function saveInventoryItem(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const id = String(formData.get("id") ?? "").trim() || null;
  const storeId = String(formData.get("store_id") ?? "");
  const section = String(formData.get("section") ?? "") as InventorySection;
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const quantity = Number(formData.get("quantity") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!storeId) return { error: "매장 정보가 없습니다." };
  if (!SECTIONS.includes(section)) return { error: "구분을 선택해 주세요." };
  if (!name) return { error: "품목명을 입력해 주세요." };
  if (!Number.isFinite(quantity) || quantity < 0) {
    return { error: "수량을 올바르게 입력해 주세요." };
  }

  const payload = { store_id: storeId, section, name, unit, quantity, notes };

  const { error } = id
    ? await supabase
        .from("inventory_items")
        .update({ ...payload, updated_by: user.id })
        .eq("id", id)
    : await supabase.from("inventory_items").insert({ ...payload, created_by: user.id });

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/inventory");
  return { success: true };
}

export async function deleteInventoryItem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("inventory_items").delete().eq("id", id);
  revalidatePath("/inventory");
}

export async function adjustQuantity(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  const delta = Number(formData.get("delta") ?? 0);
  if (!id || !Number.isFinite(delta) || delta === 0) return;

  const { data: item } = await supabase
    .from("inventory_items")
    .select("quantity")
    .eq("id", id)
    .maybeSingle();
  if (!item) return;

  const nextQuantity = Math.max(0, item.quantity + delta);

  await supabase
    .from("inventory_items")
    .update({ quantity: nextQuantity, updated_by: user.id })
    .eq("id", id);

  revalidatePath("/inventory");
}
