"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/webpush";

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
  const description = String(formData.get("description") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const startTime = String(formData.get("start_time") ?? "").trim();
  const color = String(formData.get("color") ?? "#2f7a63");
  const planType = formData.get("plan_type") === "vacation" ? "vacation" : "task";
  const followerIds = [...new Set(formData.getAll("follower_ids").map(String))];

  if (!title) return { error: "제목을 입력해 주세요." };
  if (!startDate || !endDate) return { error: "기간을 선택해 주세요." };
  if (endDate < startDate) return { error: "종료일이 시작일보다 빠를 수 없습니다." };

  const { data: inserted, error } = await supabase
    .from("monthly_plans")
    .insert({
      title,
      description: description || null,
      plan_type: planType,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime || null,
      color,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !inserted) return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };

  if (followerIds.length > 0) {
    await supabase
      .from("monthly_plan_followers")
      .insert(followerIds.map((userId) => ({ plan_id: inserted.id, user_id: userId })));
  }

  revalidatePath("/");
  return { success: true };
}

// 제목/내용/기간/시간/색상 수정. 작성자 본인만 할 수 있다(RLS에서도 동일하게 막음).
export async function updateMonthlyPlan(
  _prevState: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const startTime = String(formData.get("start_time") ?? "").trim();
  const color = String(formData.get("color") ?? "#2f7a63");
  const planType = formData.get("plan_type") === "vacation" ? "vacation" : "task";

  if (!id) return { error: "잘못된 요청입니다." };
  if (!title) return { error: "제목을 입력해 주세요." };
  if (!startDate || !endDate) return { error: "기간을 선택해 주세요." };
  if (endDate < startDate) return { error: "종료일이 시작일보다 빠를 수 없습니다." };

  const { data: plan } = await supabase
    .from("monthly_plans")
    .select("created_by")
    .eq("id", id)
    .single();
  if (!plan || plan.created_by !== user.id) {
    return { error: "작성자만 수정할 수 있습니다." };
  }

  const { error } = await supabase
    .from("monthly_plans")
    .update({
      title,
      description: description || null,
      plan_type: planType,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime || null,
      color,
    })
    .eq("id", id);

  if (error) return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };

  revalidatePath("/");
  return { success: true };
}

export async function togglePlanFollowerConfirm(planId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: follower } = await supabase
    .from("monthly_plan_followers")
    .select("id, confirmed")
    .eq("plan_id", planId)
    .eq("user_id", user.id)
    .single();
  if (!follower) return;

  await supabase
    .from("monthly_plan_followers")
    .update({ confirmed: !follower.confirmed })
    .eq("id", follower.id);

  revalidatePath("/");
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

  // 알림 발송은 부가 기능이므로, 여기서 어떤 문제가 생기더라도
  // 댓글 저장 자체는 이미 끝난 상태로 절대 실패하지 않게 한다.
  try {
    await notifyMentionedUsers(supabase, user.id, body);
  } catch (err) {
    console.error("[createPlanComment] 알림 발송 중 오류", err);
  }

  return { success: true };
}

async function sendPushToUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  payload: { title: string; body: string; url: string }
) {
  const { data: subs } = await supabase.rpc("get_push_subscriptions_for_user", {
    p_user_id: userId,
  });
  if (!subs?.length) return;

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

// 댓글 본문에 "@이름"으로 태그된 본사(마스터+팀) 계정에게 알림을 보낸다.
// 월간계획은 본사 계정끼리만 쓰는 기능이라 태그 대상도 본사 계정으로 한정한다.
async function notifyMentionedUsers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  commenterId: string,
  commentBody: string
) {
  if (!commentBody) return;

  const { data: hqProfiles } = await supabase
    .from("profiles")
    .select("id, name")
    .is("store_id", null);
  if (!hqProfiles?.length) return;

  const { data: commenterProfile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", commenterId)
    .single();
  const commenterName = commenterProfile?.name ?? "누군가";

  const mentionedIds = new Set<string>();
  for (const p of hqProfiles) {
    if (p.id === commenterId) continue;
    if (commentBody.includes(`@${p.name}`)) mentionedIds.add(p.id);
  }
  if (mentionedIds.size === 0) return;

  await Promise.all(
    [...mentionedIds].map((userId) =>
      sendPushToUser(supabase, userId, {
        title: `${commenterName}님이 회원님을 태그했습니다`,
        body: `[월간계획] ${commentBody.slice(0, 80)}`,
        url: "/",
      })
    )
  );
}

export async function deletePlanComment(id: string) {
  const supabase = await createClient();
  await supabase.from("monthly_plan_comments").delete().eq("id", id);
  revalidatePath("/");
}
