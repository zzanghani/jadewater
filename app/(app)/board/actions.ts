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
  const followerIds = [...new Set(formData.getAll("follower_ids").map(String))];
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

  if (followerIds.length > 0) {
    await supabase.from("board_post_followers").insert(
      followerIds.map((userId) => ({ post_id: inserted.id, user_id: userId }))
    );
  }

  revalidatePath("/board");

  if (followerIds.length > 0) {
    try {
      const { data: authorProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();
      const authorName = authorProfile?.name ?? "누군가";
      await Promise.all(
        followerIds
          .filter((id) => id !== user.id)
          .map((followerId) =>
            sendPushToUser(supabase, followerId, {
              title: `${authorName}님이 업무를 요청했습니다`,
              body: title,
              url: `/board/${inserted.id}`,
            })
          )
      );
    } catch (err) {
      console.error("[createBoardPost] Follower 알림 발송 중 오류", err);
    }
  }

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
    const notifiedIds = await notifyPostAuthorOfComment(supabase, postId, user.id, body);
    await notifyMentionedUsers(supabase, postId, user.id, body, notifiedIds);
  } catch (err) {
    console.error("[createBoardComment] 알림 발송 중 오류", err);
  }
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

// 게시글 작성자에게 알림을 보내고, 실제로 보낸 대상 user_id 집합을 반환한다
// (태그 알림에서 중복 발송을 피하기 위해 사용).
async function notifyPostAuthorOfComment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  commenterId: string,
  commentBody: string
): Promise<Set<string>> {
  const notified = new Set<string>();

  const { data: post } = await supabase
    .from("board_posts")
    .select("title, created_by")
    .eq("id", postId)
    .single();

  if (!post || post.created_by === commenterId) return notified;

  const { data: commenterProfile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", commenterId)
    .single();

  console.log(`[createBoardComment] post_id=${postId} 작성자에게 알림 발송 시도`);

  const commenterName = commenterProfile?.name ?? "누군가";
  await sendPushToUser(supabase, post.created_by, {
    title: `${commenterName}님이 댓글을 남겼습니다`,
    body: `"${post.title}" · ${commentBody.slice(0, 60)}`,
    url: `/board/${postId}`,
  });

  notified.add(post.created_by);
  return notified;
}

// 댓글 본문에 "@이름"으로 태그된 사람들에게 별도 알림을 보낸다.
// 이미 글쓴이 알림으로 발송된 사람(alreadyNotified)과 댓글 작성자 본인은 제외한다.
async function notifyMentionedUsers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  commenterId: string,
  commentBody: string,
  alreadyNotified: Set<string>
) {
  const { data: profiles } = await supabase.from("profiles").select("id, name");
  if (!profiles?.length) return;

  const { data: commenterProfile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", commenterId)
    .single();
  const commenterName = commenterProfile?.name ?? "누군가";

  const mentionedIds = new Set<string>();
  for (const p of profiles) {
    if (p.id === commenterId || alreadyNotified.has(p.id)) continue;
    if (commentBody.includes(`@${p.name}`)) mentionedIds.add(p.id);
  }

  if (mentionedIds.size === 0) return;

  console.log(`[createBoardComment] post_id=${postId} 태그 알림 대상 ${mentionedIds.size}명`);

  await Promise.all(
    [...mentionedIds].map((userId) =>
      sendPushToUser(supabase, userId, {
        title: `${commenterName}님이 회원님을 태그했습니다`,
        body: commentBody.slice(0, 80),
        url: `/board/${postId}`,
      })
    )
  );
}

// Order 확인과 Follower 전원 확인이 모두 끝났는지 다시 계산해서
// completed_at을 갱신한다. Follower가 한 명도 없으면(공지성 글) 업무
// 체크리스트 자체가 없는 글이므로 완료 처리하지 않는다.
async function recomputePostCompletion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string
) {
  const [{ data: post }, { data: followers }] = await Promise.all([
    supabase.from("board_posts").select("requester_confirmed").eq("id", postId).single(),
    supabase.from("board_post_followers").select("confirmed").eq("post_id", postId),
  ]);
  if (!post) return;

  const hasFollowers = (followers?.length ?? 0) > 0;
  const allFollowersConfirmed = hasFollowers && followers!.every((f) => f.confirmed);
  const bothConfirmed = post.requester_confirmed && allFollowersConfirmed;

  await supabase
    .from("board_posts")
    .update({ completed_at: bothConfirmed ? new Date().toISOString() : null })
    .eq("id", postId);

  revalidatePath(`/board/${postId}`);
  revalidatePath("/board");
}

export async function toggleRequesterConfirm(postId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: post } = await supabase
    .from("board_posts")
    .select("created_by, requester_confirmed")
    .eq("id", postId)
    .single();
  if (!post || user.id !== post.created_by) return;

  await supabase
    .from("board_posts")
    .update({ requester_confirmed: !post.requester_confirmed })
    .eq("id", postId);

  await recomputePostCompletion(supabase, postId);
}

export async function toggleFollowerConfirm(postId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: follower } = await supabase
    .from("board_post_followers")
    .select("id, confirmed")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .single();
  if (!follower) return;

  await supabase
    .from("board_post_followers")
    .update({ confirmed: !follower.confirmed })
    .eq("id", follower.id);

  await recomputePostCompletion(supabase, postId);
}
