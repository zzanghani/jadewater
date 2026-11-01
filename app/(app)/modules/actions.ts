"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MODULE_BY_KEY, type ModuleKey } from "@/lib/modules";

export type ModuleActionResult = { error?: string } | undefined;

// 브랜드의 기능 모듈을 켜고 끈다(결제 연동 전 수동 운영). 본사 마스터만.
// DB 쪽도 brand_modules RLS(user_is_master)가 한 번 더 막는다.
export async function setBrandModule(input: {
  brandId: string;
  moduleKey: string;
  status: "active" | "trial" | "inactive";
  /** trial 일 때 체험 종료일(YYYY-MM-DD). 없으면 30일 뒤. */
  trialEndsOn?: string | null;
  note?: string | null;
}): Promise<ModuleActionResult> {
  if (!(input.moduleKey in MODULE_BY_KEY)) return { error: "알 수 없는 기능 모듈입니다." };
  const key = input.moduleKey as ModuleKey;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id, department")
    .eq("id", user.id)
    .single();
  if (!profile || profile.store_id || profile.department) {
    return { error: "마스터 계정만 바꿀 수 있습니다." };
  }

  let trialEndsAt: string | null = null;
  if (input.status === "trial") {
    const d = input.trialEndsOn ? new Date(`${input.trialEndsOn}T23:59:59+09:00`) : new Date(Date.now() + 30 * 86400000);
    if (Number.isNaN(d.getTime())) return { error: "체험 종료일이 올바르지 않습니다." };
    trialEndsAt = d.toISOString();
  }

  const { error } = await supabase.from("brand_modules").upsert(
    {
      brand_id: input.brandId,
      module_key: key,
      status: input.status,
      trial_ends_at: trialEndsAt,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
      note: input.note ?? null,
    },
    { onConflict: "brand_id,module_key" }
  );
  if (error) {
    console.error("[setBrandModule]", error);
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/modules");
  revalidatePath("/", "layout");
  return undefined;
}
