"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function isMasterAccount(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id, department")
    .eq("id", user.id)
    .single();
  return !!profile && !profile.store_id && !profile.department;
}

export type AccountActionResult = { error?: string } | undefined;

export async function approveAccount(userId: string): Promise<AccountActionResult> {
  const supabase = await createClient();
  if (!(await isMasterAccount(supabase))) return { error: "마스터 계정만 처리할 수 있습니다." };

  const { error } = await supabase
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", userId);

  if (error) return { error: "승인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };

  revalidatePath("/accounts");
  return undefined;
}

export async function rejectAccount(userId: string): Promise<AccountActionResult> {
  const supabase = await createClient();
  if (!(await isMasterAccount(supabase))) return { error: "마스터 계정만 처리할 수 있습니다." };

  const { error } = await supabase
    .from("profiles")
    .update({ status: "rejected" })
    .eq("id", userId);

  if (error) return { error: "거절 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };

  revalidatePath("/accounts");
  return undefined;
}
