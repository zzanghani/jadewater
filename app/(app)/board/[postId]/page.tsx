import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import BoardAttachmentList from "@/components/BoardAttachmentList";
import BoardCommentForm from "@/components/BoardCommentForm";
import BoardPostHeader from "@/components/BoardPostHeader";
import Avatar from "@/components/Avatar";
import { fetchAvatarUrlById } from "@/lib/avatar";
import { extractInlineStoragePaths } from "@/lib/boardBody";
import { daysSinceKST, kstDateTimeLabel as dateTimeLabel } from "@/lib/date";
import { renderRichText } from "@/lib/richText";

export default async function BoardPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const supabase = await createClient();

  const [{ data: post }, { data: { user } }, { stores }] = await Promise.all([
    supabase.from("board_posts").select("*").eq("id", postId).single(),
    supabase.auth.getUser(),
    getStoreContext(supabase),
  ]);

  if (!post) notFound();

  const { data: viewerProfile } = user
    ? await supabase.from("profiles").select("department").eq("id", user.id).single()
    : { data: null };
  const isMaster = stores.length > 1 && !viewerProfile?.department;

  const { data: comments } = await supabase
    .from("board_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  const commentRows = comments ?? [];
  const commentIds = commentRows.map((c) => c.id);

  const { data: postFollowers } = await supabase
    .from("board_post_followers")
    .select("*")
    .eq("post_id", postId);
  const followerRows = postFollowers ?? [];

  const authorIds = [
    ...new Set(
      [post.created_by, ...followerRows.map((f) => f.user_id), ...commentRows.map((c) => c.created_by)]
    ),
  ];

  const [{ data: profiles }, { data: postAttachments }, { data: commentAttachments }, { data: allProfiles }, avatarById] =
    await Promise.all([
      supabase.from("profiles").select("id, name").in("id", authorIds),
      supabase.from("board_attachments").select("*").eq("post_id", postId),
      commentIds.length > 0
        ? supabase.from("board_attachments").select("*").in("comment_id", commentIds)
        : Promise.resolve({ data: [] as { id: string; comment_id: string | null; storage_path: string; file_name: string }[] }),
      supabase.from("profiles").select("id, name"),
      fetchAvatarUrlById(supabase, authorIds),
    ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  const followers = followerRows.map((f) => ({
    userId: f.user_id,
    name: nameById.get(f.user_id) ?? "알 수 없음",
    confirmed: f.confirmed,
  }));

  const allAttachments = [...(postAttachments ?? []), ...(commentAttachments ?? [])];
  const signedUrlByPath = new Map<string, string>();
  const downloadUrlByPath = new Map<string, string>();
  if (allAttachments.length > 0) {
    const paths = allAttachments.map((a) => a.storage_path);
    // 다운로드 버튼용 서명 URL은 따로 받는다 — Content-Disposition을
    // attachment로 붙여야 다른 도메인 URL이라도 <a download>가 아닌
    // 진짜 다운로드로 동작한다(사파리에서 그냥 열리기만 하던 문제).
    const [{ data: signedUrls }, { data: downloadSignedUrls }] = await Promise.all([
      supabase.storage.from("board").createSignedUrls(paths, 3600),
      supabase.storage.from("board").createSignedUrls(paths, 3600, { download: true }),
    ]);
    for (const s of signedUrls ?? []) {
      if (s.signedUrl) signedUrlByPath.set(s.path ?? "", s.signedUrl);
    }
    for (const s of downloadSignedUrls ?? []) {
      if (s.signedUrl) downloadUrlByPath.set(s.path ?? "", s.signedUrl);
    }
  }

  const urlByPath = Object.fromEntries(signedUrlByPath);

  // 본문/토글 안에 사진·파일로 이미 표시되는 첨부는 아래 "첨부파일" 목록에
  // 중복으로 뜨지 않게 뺀다.
  const inlinePaths = new Set(extractInlineStoragePaths(post.body).map((p) => p.path));
  const postAttachmentRows = (postAttachments ?? [])
    .filter((a) => !inlinePaths.has(a.storage_path))
    .map((a) => ({
      id: a.id,
      file_name: a.file_name,
      url: signedUrlByPath.get(a.storage_path),
      downloadUrl: downloadUrlByPath.get(a.storage_path),
    }));

  const commentAttachmentsByCommentId = new Map<
    string,
    { id: string; file_name: string; url?: string; downloadUrl?: string }[]
  >();
  for (const a of commentAttachments ?? []) {
    if (!a.comment_id) continue;
    const list = commentAttachmentsByCommentId.get(a.comment_id) ?? [];
    list.push({
      id: a.id,
      file_name: a.file_name,
      url: signedUrlByPath.get(a.storage_path),
      downloadUrl: downloadUrlByPath.get(a.storage_path),
    });
    commentAttachmentsByCommentId.set(a.comment_id, list);
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/board?category=${encodeURIComponent(post.category)}`}
        className="flex items-center gap-1 text-sm font-medium text-muted"
      >
        <span aria-hidden>←</span> 목록으로
      </Link>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <BoardPostHeader
          postId={post.id}
          category={post.category}
          title={post.title}
          body={post.body}
          authorLabel={`${nameById.get(post.created_by) ?? "알 수 없음"} · ${dateTimeLabel(post.created_at)}`}
          authorAvatarUrl={avatarById.get(post.created_by)}
          isMaster={isMaster}
          followers={followers}
          requesterConfirmed={post.requester_confirmed}
          requesterName={nameById.get(post.created_by) ?? "알 수 없음"}
          canConfirmRequester={user?.id === post.created_by}
          currentUserId={user?.id}
          allProfiles={allProfiles ?? []}
          urlByPath={urlByPath}
        />
        <BoardAttachmentList attachments={postAttachmentRows} />

        {followers.length > 0 && !post.completed_at && daysSinceKST(post.created_at) >= 3 && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            🚨 긴급: 게시일로부터 {daysSinceKST(post.created_at)}일 경과했습니다
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          댓글 {commentRows.length > 0 ? commentRows.length : ""}
        </h2>

        {commentRows.length > 0 && (
          <ul className="flex flex-col gap-3">
            {commentRows.map((c) => (
              <li key={c.id} className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-3">
                <p className="flex items-center gap-2 text-2xl font-semibold text-foreground">
                  <Avatar
                    name={nameById.get(c.created_by) ?? "?"}
                    avatarUrl={avatarById.get(c.created_by)}
                    size={36}
                  />
                  {nameById.get(c.created_by) ?? "알 수 없음"}
                  <span className="ml-1 font-normal text-muted">{dateTimeLabel(c.created_at)}</span>
                </p>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {renderRichText(c.body, (allProfiles ?? []).map((p) => p.name))}
                </p>
                <BoardAttachmentList attachments={commentAttachmentsByCommentId.get(c.id) ?? []} />
              </li>
            ))}
          </ul>
        )}

        <BoardCommentForm postId={postId} profiles={allProfiles ?? []} />
      </section>
    </div>
  );
}
