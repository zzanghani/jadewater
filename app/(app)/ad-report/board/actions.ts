"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adCanEdit } from "@/lib/adAccess";

// 점장이 "확인했어요"를 누르면 기록한다 (마스터는 누가 확인했는지 본다).
export async function markAdPostRead(storeId: string, date: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data: p } = await supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle();
  if (!adCanEdit(p, storeId)) return { ok: false, error: "자기 매장 글만 확인할 수 있어요." };
  const { error } = await supabase.from("ad_daily_post_reads").upsert({ store_id: storeId, date, user_id: user.id }, { onConflict: "store_id,date,user_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ad-report/board");
  return { ok: true };
}
