"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { sendPush } from "@/lib/webpush";
import { archiveBoardPostToDrive } from "@/lib/boardArchive";
import { NOTICE } from "@/lib/board";
import { extractInlineStoragePaths } from "@/lib/boardBody";
import type { BoardCategory } from "@/lib/types";

const BOARD_CATEGORIES: BoardCategory[] = ["공지사항", "마케팅", "운영HR", "디자인", "R&D"];

export type BoardFormState = { error?: string } | undefined;

// stores.length > 1만 보면 본사 팀 계정(department 있음)도 전 매장이 보여서
// 마스터로 오판된다. department가 없어야 진짜 마스터.
async function isMasterAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const [{ stores }, { data: profile }] = await Promise.all([
    getStoreContext(supabase),
    supabase.from("profiles").select("department").eq("id", userId).single(),
  ]);
  return stores.length > 1 && !profile?.department;
}

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

export type InlineUploadResult =
  | { path: string; url: string; fileName: string; isImage: boolean }
  | { error: string };

// 토글/본문 안에 사진·파일을 바로 넣기 위한 즉시 업로드. 글이 아직 저장
// 전이라 post_id가 없으므로, 일단 스토리지에만 올려두고 경로를 돌려주면
// 클라이언트가 "![파일명](경로)" 같은 참조를 본문에 바로 삽입한다. 실제
// board_attachments 등록은 글이 실제로 저장될 때(createBoardPost/
// updateBoardPost) 본문에서 참조를 다시 읽어 처리한다.
export async function uploadInlineBoardFile(formData: FormData): Promise<InlineUploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "파일을 선택해 주세요." };

  const ext = file.name.split(".").pop() || "bin";
  const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("board")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (uploadError) return { error: "업로드 중 오류가 발생했습니다." };

  const { data: signed } = await supabase.storage.from("board").createSignedUrl(path, 3600);
  if (!signed?.signedUrl) return { error: "미리보기를 불러오는 중 오류가 발생했습니다." };

  return {
    path,
    url: signed.signedUrl,
    fileName: file.name,
    isImage: file.type.startsWith("image/"),
  };
}

// 본문(토글 안 포함)에 사진/파일로 참조된 스토리지 경로를, 아직
// board_attachments에 없는 것만 새로 등록한다. 첨부파일 목록·글 삭제 시
// 정리 대상에 자동으로 포함되게 하기 위함.
async function registerInlineAttachments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  postId: string,
  body: string
) {
  const referenced = extractInlineStoragePaths(body);
  if (referenced.length === 0) return;

  const { data: existing } = await supabase
    .from("board_attachments")
    .select("storage_path")
    .eq("post_id", postId);
  const existingPaths = new Set((existing ?? []).map((a) => a.storage_path));

  const toInsert = referenced.filter((r) => !existingPaths.has(r.path));
  if (toInsert.length === 0) return;

  await supabase.from("board_attachments").insert(
    toInsert.map((r) => ({
      post_id: postId,
      storage_path: r.path,
      file_name: r.fileName,
      created_by: userId,
    }))
  );
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

  const categoryRaw = String(formData.get("category") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  const followerIds = [...new Set(formData.getAll("follower_ids").map(String))];
  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File);

  if (!BOARD_CATEGORIES.includes(categoryRaw as BoardCategory)) {
    return { error: "카테고리를 올바르게 선택해 주세요." };
  }
  if (!title) return { error: "제목을 입력해 주세요." };
  if (!body) return { error: "내용을 입력해 주세요." };

  const category = categoryRaw as BoardCategory;

  if (category === NOTICE && !(await isMasterAccount(supabase, user.id))) {
    return { error: "공지사항은 마스터 계정만 등록할 수 있습니다." };
  }

  const { data: inserted, error } = await supabase
    .from("board_posts")
    .insert({ category, title, body, created_by: user.id })
    .select()
    .single();

  if (error || !inserted) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  await uploadAttachments(supabase, user.id, files, { post_id: inserted.id });
  await registerInlineAttachments(supabase, user.id, inserted.id, body);

  if (followerIds.length > 0) {
    await supabase.from("board_post_followers").insert(
      followerIds.map((userId) => ({ post_id: inserted.id, user_id: userId }))
    );
  }

  revalidatePath("/board");

  try {
    const { data: authorProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();
    const authorName = authorProfile?.name ?? "누군가";
    const notified = new Set<string>([user.id]);

    if (followerIds.length > 0) {
      await Promise.all(
        followerIds
          .filter((id) => !notified.has(id))
          .map((followerId) => {
            notified.add(followerId);
            return sendPushToUser(supabase, followerId, {
              title: `${authorName}님이 업무를 요청했습니다`,
              body: title,
              url: `/board/${inserted.id}`,
            });
          })
      );
    }

    // 공지사항(마스터 계정 전용)은 개별 Follower 지정 여부와 상관없이
    // 전 계정에 알림을 보낸다.
    if (category === NOTICE) {
      const { data: allProfiles } = await supabase.from("profiles").select("id");
      const targets = (allProfiles ?? [])
        .map((p) => p.id)
        .filter((id) => !notified.has(id));
      await Promise.all(
        targets.map((id) => {
          notified.add(id);
          return sendPushToUser(supabase, id, {
            title: `${authorName}님이 공지사항을 등록했습니다`,
            body: title,
            url: `/board/${inserted.id}`,
          });
        })
      );
    }
  } catch (err) {
    console.error("[createBoardPost] 알림 발송 중 오류", err);
  }

  redirect(`/board/${inserted.id}`);
}

// 제목/내용 수정. 마스터 계정만 할 수 있다. Order 확인 체크는 수정 폼에서
// 다시 켜고 끌 수 있고, Follower는 명단 자체를 더하거나 뺄 수 있다(뺀
// 사람은 확인 여부와 무관하게 완전히 빠지고, Follower가 하나도 안 남으면
// 이 글은 완료 처리 대상에서 제외돼 그냥 게시판에 남는다).
export async function updateBoardPost(
  _prevState: BoardFormState,
  formData: FormData
): Promise<BoardFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const postId = String(formData.get("post_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  const followerIds = [...new Set(formData.getAll("follower_ids").map(String))];

  if (!postId) return { error: "잘못된 요청입니다." };
  if (!title) return { error: "제목을 입력해 주세요." };
  if (!body) return { error: "내용을 입력해 주세요." };

  if (!(await isMasterAccount(supabase, user.id))) {
    return { error: "수정은 마스터 계정만 할 수 있습니다." };
  }

  const requesterConfirmed = formData.get("requester_confirmed") === "on";

  const { error } = await supabase
    .from("board_posts")
    .update({ title, body, requester_confirmed: requesterConfirmed })
    .eq("id", postId);

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  await registerInlineAttachments(supabase, user.id, postId, body);

  const { data: existingFollowers } = await supabase
    .from("board_post_followers")
    .select("user_id")
    .eq("post_id", postId);

  const existingIds = new Set((existingFollowers ?? []).map((f) => f.user_id));
  const toAdd = followerIds.filter((id) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !followerIds.includes(id));

  if (toRemove.length > 0) {
    await supabase
      .from("board_post_followers")
      .delete()
      .eq("post_id", postId)
      .in("user_id", toRemove);
  }
  if (toAdd.length > 0) {
    await supabase
      .from("board_post_followers")
      .insert(toAdd.map((userId) => ({ post_id: postId, user_id: userId })));
  }

  await recomputePostCompletion(supabase, postId);

  revalidatePath(`/board/${postId}`);
  revalidatePath("/board");
  redirect(`/board/${postId}`);
}

export type DeletePostState = { error?: string; success?: boolean } | undefined;

// 글 삭제. 작성자 본인 또는 마스터 계정만 할 수 있다(RLS에서도 동일하게
// 막혀 있어 이중으로 확인). 첨부파일은 Storage에서 별도로 지워야 하고,
// 댓글/Follower/첨부파일 행은 board_posts를 지우면 cascade로 같이 지워진다.
export async function deleteBoardPostAction(postId: string): Promise<DeletePostState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: post } = await supabase
    .from("board_posts")
    .select("created_by")
    .eq("id", postId)
    .single();
  if (!post) return { error: "글을 찾을 수 없습니다." };

  if (post.created_by !== user.id && !(await isMasterAccount(supabase, user.id))) {
    return { error: "본인이 쓴 글만 삭제할 수 있습니다." };
  }

  const { data: comments } = await supabase
    .from("board_comments")
    .select("id")
    .eq("post_id", postId);
  const commentIds = (comments ?? []).map((c) => c.id);

  const [{ data: postAttachments }, { data: commentAttachments }] = await Promise.all([
    supabase.from("board_attachments").select("storage_path").eq("post_id", postId),
    commentIds.length > 0
      ? supabase.from("board_attachments").select("storage_path").in("comment_id", commentIds)
      : Promise.resolve({ data: [] as { storage_path: string }[] }),
  ]);

  const storagePaths = [...(postAttachments ?? []), ...(commentAttachments ?? [])].map(
    (a) => a.storage_path
  );
  if (storagePaths.length > 0) {
    await supabase.storage.from("board").remove(storagePaths);
  }

  const { error } = await supabase.from("board_posts").delete().eq("id", postId);
  if (error) {
    return { error: "삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/board");
  return { success: true };
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
  // 사진/파일은 이제 댓글 등록 전에 uploadInlineBoardFile로 미리
  // 올려두고, 그 경로만 여기로 받아서 댓글에 연결한다(채팅과 같은
  // 방식) — 예전처럼 폼 제출과 동시에 올리던 방식에서 사진 첨부가
  // 가끔 깨지던 문제가 있어 바꿨다.
  const attachmentPaths = formData.getAll("attachment_path").map(String);
  const attachmentNames = formData.getAll("attachment_name").map(String);

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

  if (attachmentPaths.length > 0) {
    await supabase.from("board_attachments").insert(
      attachmentPaths.map((path, i) => ({
        comment_id: inserted.id,
        storage_path: path,
        file_name: attachmentNames[i] ?? path,
        created_by: user.id,
      }))
    );
  }

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

  const [{ data: follower }, { data: allFollowers }, { data: post }] = await Promise.all([
    supabase
      .from("board_post_followers")
      .select("id, confirmed")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .single(),
    supabase.from("board_post_followers").select("user_id, confirmed").eq("post_id", postId),
    supabase.from("board_posts").select("created_by, title").eq("id", postId).single(),
  ]);
  if (!follower) return;

  const newConfirmed = !follower.confirmed;

  await supabase
    .from("board_post_followers")
    .update({ confirmed: newConfirmed })
    .eq("id", follower.id);

  await recomputePostCompletion(supabase, postId);

  // 팔로워 전원 확인이 방금(이번 클릭으로) 완료된 시점이면 작성자에게 알림.
  // 이미 전원 확인된 상태에서 다시 껐다 켜는 경우는 그때마다 다시 알린다.
  const followerCount = allFollowers?.length ?? 0;
  const othersAllConfirmed = (allFollowers ?? [])
    .filter((f) => f.user_id !== user.id)
    .every((f) => f.confirmed);
  const wasAllConfirmed = followerCount > 0 && othersAllConfirmed && follower.confirmed;
  const isAllConfirmedNow = followerCount > 0 && othersAllConfirmed && newConfirmed;

  if (!wasAllConfirmed && isAllConfirmedNow && post && post.created_by !== user.id) {
    try {
      await sendPushToUser(supabase, post.created_by, {
        title: "팔로워 전원 확인 완료",
        body: `"${post.title}" 담당자 전원이 확인을 완료했습니다.`,
        url: `/board/${postId}`,
      });
    } catch (err) {
      console.error("[toggleFollowerConfirm] 알림 발송 중 오류", err);
    }
  }
}

export type ArchiveState = { error?: string; success?: boolean } | undefined;

// 완료된 글을 구글드라이브로 옮기고 Supabase에서는 지운다 (되돌릴 수 없음).
// 마스터 계정만 할 수 있다.
export async function archiveBoardPostAction(postId: string): Promise<ArchiveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  if (!(await isMasterAccount(supabase, user.id))) {
    return { error: "마스터 계정만 보관할 수 있습니다." };
  }

  let storagePaths: string[];
  try {
    const result = await archiveBoardPostToDrive(supabase, postId);
    storagePaths = result.storagePaths;
  } catch (err) {
    console.error("[archiveBoardPostAction] 드라이브 업로드 실패", err);
    return { error: "구글드라이브 업로드 중 오류가 발생했습니다." };
  }

  if (storagePaths.length > 0) {
    await supabase.storage.from("board").remove(storagePaths);
  }

  const { error: deleteError } = await supabase.from("board_posts").delete().eq("id", postId);
  if (deleteError) {
    console.error("[archiveBoardPostAction] Supabase 삭제 실패", deleteError);
    return {
      error: "드라이브 업로드는 됐지만 Supabase에서 삭제하는 중 오류가 발생했습니다.",
    };
  }

  revalidatePath("/board");
  return { success: true };
}
