import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BoardAttachmentList from "@/components/BoardAttachmentList";
import BoardCommentForm from "@/components/BoardCommentForm";
import BoardTaskCheckboxes from "@/components/BoardTaskCheckboxes";

function dateTimeLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export default async function BoardPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const supabase = await createClient();

  const [{ data: post }, { data: { user } }] = await Promise.all([
    supabase.from("board_posts").select("*").eq("id", postId).single(),
    supabase.auth.getUser(),
  ]);

  if (!post) notFound();

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

  const [{ data: profiles }, { data: postAttachments }, { data: commentAttachments }, { data: allProfiles }] =
    await Promise.all([
      supabase.from("profiles").select("id, name").in("id", authorIds),
      supabase.from("board_attachments").select("*").eq("post_id", postId),
      commentIds.length > 0
        ? supabase.from("board_attachments").select("*").in("comment_id", commentIds)
        : Promise.resolve({ data: [] as { id: string; comment_id: string | null; storage_path: string; file_name: string }[] }),
      supabase.from("profiles").select("id, name"),
    ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  const followers = followerRows.map((f) => ({
    userId: f.user_id,
    name: nameById.get(f.user_id) ?? "알 수 없음",
    confirmed: f.confirmed,
  }));

  const allAttachments = [...(postAttachments ?? []), ...(commentAttachments ?? [])];
  const signedUrlByPath = new Map<string, string>();
  if (allAttachments.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("board")
      .createSignedUrls(
        allAttachments.map((a) => a.storage_path),
        3600
      );
    for (const s of signedUrls ?? []) {
      if (s.signedUrl) signedUrlByPath.set(s.path ?? "", s.signedUrl);
    }
  }

  const postAttachmentRows = (postAttachments ?? []).map((a) => ({
    id: a.id,
    file_name: a.file_name,
    url: signedUrlByPath.get(a.storage_path),
  }));

  const commentAttachmentsByCommentId = new Map<string, { id: string; file_name: string; url?: string }[]>();
  for (const a of commentAttachments ?? []) {
    if (!a.comment_id) continue;
    const list = commentAttachmentsByCommentId.get(a.comment_id) ?? [];
    list.push({ id: a.id, file_name: a.file_name, url: signedUrlByPath.get(a.storage_path) });
    commentAttachmentsByCommentId.set(a.comment_id, list);
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/board" className="flex items-center gap-1 text-sm font-medium text-muted">
        <span aria-hidden>←</span> 목록으로
      </Link>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">{post.title}</h1>
            <p className="mt-1 text-xs text-muted">
              {nameById.get(post.created_by) ?? "알 수 없음"} · {dateTimeLabel(post.created_at)}
            </p>
          </div>
          {followers.length > 0 && (
            <BoardTaskCheckboxes
              postId={post.id}
              requesterConfirmed={post.requester_confirmed}
              requesterName={nameById.get(post.created_by) ?? "알 수 없음"}
              canConfirmRequester={user?.id === post.created_by}
              followers={followers}
              currentUserId={user?.id}
            />
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm text-foreground">{post.body}</p>
        <BoardAttachmentList attachments={postAttachmentRows} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          댓글 {commentRows.length > 0 ? commentRows.length : ""}
        </h2>

        {commentRows.length > 0 && (
          <ul className="flex flex-col gap-3">
            {commentRows.map((c) => (
              <li key={c.id} className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-3">
                <p className="text-xs font-semibold text-foreground">
                  {nameById.get(c.created_by) ?? "알 수 없음"}
                  <span className="ml-2 font-normal text-muted">{dateTimeLabel(c.created_at)}</span>
                </p>
                <p className="whitespace-pre-wrap text-sm text-foreground">{c.body}</p>
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
