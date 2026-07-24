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
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!storeId) return { error: "매장 정보가 없습니다." };
  if (!SECTIONS.includes(section)) return { error: "구분을 선택해 주세요." };
  if (!name) return { error: "품목명을 입력해 주세요." };

  const payload = { store_id: storeId, section, name, unit, notes };

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

// 재고 마감(그 날짜에 화면에 보이는 품목 전부의 수량)을 한 번에 저장한다.
export async function saveDailyCounts(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const storeId = String(formData.get("store_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const itemIds = String(formData.get("item_ids") ?? "")
    .split(",")
    .filter(Boolean);

  if (!storeId) return { error: "매장 정보가 없습니다." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "잘못된 요청입니다." };
  if (itemIds.length === 0) return { success: true };

  const rows = itemIds.map((itemId) => ({
    item_id: itemId,
    store_id: storeId,
    date,
    quantity: Number(formData.get(`qty_${itemId}`) ?? 0) || 0,
    created_by: user.id,
    updated_by: user.id,
  }));

  const { error } = await supabase
    .from("inventory_counts")
    .upsert(rows, { onConflict: "item_id,date" });

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/inventory");
  return { success: true };
}
