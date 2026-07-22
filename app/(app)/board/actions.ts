"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/webpush";

export type BoardFormState = { error?: string } | undefined;

async function uploadAttachments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  files: File[],
  target: { post_id: string } | { comment_id: string }
) {
  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("board")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (uploadError) continue;

    await supabase.from("board_attachments").insert({
      ...target,
      storage_path: path,
      file_name: file.name,
      created_by: userId,
    });
  }
}

export async function createBoardPost(
  _prevState: BoardFormState,
  formData: FormData
): Promise<BoardFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File);

  if (!title) return { error: "제목을 입력해 주세요." };
  if (!body) return { error: "내용을 입력해 주세요." };

  const { data: inserted, error } = await supabase
    .from("board_posts")
    .insert({ title, body, created_by: user.id })
    .select()
    .single();

  if (error || !inserted) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  await uploadAttachments(supabase, user.id, files, { post_id: inserted.id });

  revalidatePath("/board");
  redirect(`/board/${inserted.id}`);
}

export async function createBoardComment(
  _prevState: BoardFormState,
  formData: FormData
): Promise<BoardFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const postId = String(formData.get("post_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File);

  if (!postId) return { error: "잘못된 요청입니다." };
  if (!body) return { error: "댓글 내용을 입력해 주세요." };

  const { data: inserted, error } = await supabase
    .from("board_comments")
    .insert({ post_id: postId, body, created_by: user.id })
    .select()
    .single();

  if (error || !inserted) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  await uploadAttachments(supabase, user.id, files, { comment_id: inserted.id });

  revalidatePath(`/board/${postId}`);

  // 알림 발송은 부가 기능이므로, 여기서 어떤 문제가 생기더라도
  // 댓글 저장 자체는 이미 끝난 상태로 절대 실패하지 않게 한다.
  try {
    await notifyPostAuthorOfComment(supabase, postId, user.id, body);
  } catch (err) {
    console.error("[createBoardComment] 알림 발송 중 오류", err);
  }
}

async function notifyPostAuthorOfComment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  commenterId: string,
  commentBody: string
) {
  const { data: post } = await supabase
    .from("board_posts")
    .select("title, created_by")
    .eq("id", postId)
    .single();

  if (!post || post.created_by === commenterId) return;

  const [{ data: commenterProfile }, { data: subs }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", commenterId).single(),
    supabase.rpc("get_push_subscriptions_for_user", { p_user_id: post.created_by }),
  ]);

  console.log(
    `[createBoardComment] post_id=${postId} 작성자 구독 ${subs?.length ?? 0}건 발견`
  );

  if (!subs?.length) return;

  const commenterName = commenterProfile?.name ?? "누군가";
  const payload = {
    title: `${commenterName}님이 댓글을 남겼습니다`,
    body: `"${post.title}" · ${commentBody.slice(0, 60)}`,
    url: `/board/${postId}`,
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
