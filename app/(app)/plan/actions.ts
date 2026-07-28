"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PlanFormState = { error?: string; success?: boolean } | undefined;

export async function createMonthlyPlan(
  _prevState: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const title = String(formData.get("title") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const color = String(formData.get("color") ?? "#2f7a63");

  if (!title) return { error: "제목을 입력해 주세요." };
  if (!startDate || !endDate) return { error: "기간을 선택해 주세요." };
  if (endDate < startDate) return { error: "종료일이 시작일보다 빠를 수 없습니다." };

  const { error } = await supabase.from("monthly_plans").insert({
    title,
    start_date: startDate,
    end_date: endDate,
    color,
    created_by: user.id,
  });

  if (error) return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };

  revalidatePath("/");
  return { success: true };
}

export async function deleteMonthlyPlan(id: string) {
  const supabase = await createClient();
  await supabase.from("monthly_plans").delete().eq("id", id);
  revalidatePath("/");
}

async function uploadPlanAttachments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  files: File[],
  commentId: string
) {
  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("monthly-plans")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (uploadError) continue;

    await supabase.from("monthly_plan_attachments").insert({
      comment_id: commentId,
      storage_path: path,
      file_name: file.name,
      created_by: userId,
    });
  }
}

export async function createPlanComment(
  _prevState: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const planId = String(formData.get("plan_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);

  if (!planId) return { error: "잘못된 요청입니다." };
  if (!body && files.length === 0) {
    return { error: "댓글 내용을 입력하거나 파일을 첨부해 주세요." };
  }

  const { data: inserted, error } = await supabase
    .from("monthly_plan_comments")
    .insert({ plan_id: planId, body, created_by: user.id })
    .select()
    .single();

  if (error || !inserted) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  if (files.length > 0) {
    await uploadPlanAttachments(supabase, user.id, files, inserted.id);
  }

  revalidatePath("/");
  return { success: true };
}

export async function deletePlanComment(id: string) {
  const supabase = await createClient();
  await supabase.from("monthly_plan_comments").delete().eq("id", id);
  revalidatePath("/");
}
