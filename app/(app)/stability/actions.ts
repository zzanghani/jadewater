"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StabilityActionResult = { error?: string } | undefined;

async function masterUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "로그인이 필요합니다." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id, department")
    .eq("id", user.id)
    .single();
  if (!profile || profile.store_id || profile.department) {
    return { supabase, user: null, error: "대표(마스터) 계정만 쓸 수 있습니다." };
  }
  return { supabase, user, error: null };
}

// 그날 점검 결과를 '확인했어요'로 표시한다. DB 쪽도 RLS(user_is_master)가 한 번 더 막는다.
export async function markReportChecked(date: string): Promise<StabilityActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "날짜가 올바르지 않습니다." };
  const { supabase, user, error } = await masterUser();
  if (!user) return { error: error ?? "권한이 없습니다." };

  const { error: dbError } = await supabase
    .from("stability_reports")
    .update({ checked_at: new Date().toISOString(), checked_by: user.id })
    .eq("date", date);
  if (dbError) {
    console.error("[markReportChecked]", dbError);
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
  revalidatePath("/stability");
}

// 피드백(고칠 점·궁금한 점)을 남긴다. 다음 아침 점검 루틴이 읽어 반영하고 답을 남긴다.
export async function submitStabilityFeedback(input: {
  reportDate: string | null;
  body: string;
}): Promise<StabilityActionResult> {
  const body = input.body.trim();
  if (!body) return { error: "내용을 적어 주세요." };
  if (body.length > 2000) return { error: "2000자 안으로 적어 주세요." };
  if (input.reportDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.reportDate)) return { error: "날짜가 올바르지 않습니다." };

  const { supabase, user, error } = await masterUser();
  if (!user) return { error: error ?? "권한이 없습니다." };

  const { error: dbError } = await supabase.from("stability_feedback").insert({
    report_date: input.reportDate,
    body,
    created_by: user.id,
  });
  if (dbError) {
    console.error("[submitStabilityFeedback]", dbError);
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
  revalidatePath("/stability");
}

// 대표가 직접 피드백을 '처리됨'으로 닫거나 다시 연다.
export async function setFeedbackStatus(id: string, status: "open" | "done"): Promise<StabilityActionResult> {
  const { supabase, user, error } = await masterUser();
  if (!user) return { error: error ?? "권한이 없습니다." };

  const { error: dbError } = await supabase.from("stability_feedback").update({ status }).eq("id", id);
  if (dbError) {
    console.error("[setFeedbackStatus]", dbError);
    return { error: "저장 중 오류가 발생했습니다." };
  }
  revalidatePath("/stability");
}
