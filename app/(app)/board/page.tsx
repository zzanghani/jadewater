import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function timeAgoLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default async function BoardPage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("board_posts")
    .select("*")
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = posts ?? [];
  const postIds = rows.map((p) => p.id);

  const [{ data: followerRows }, { data: comments }] = await Promise.all([
    postIds.length > 0
      ? supabase.from("board_post_followers").select("post_id, user_id").in("post_id", postIds)
      : Promise.resolve({ data: [] as { post_id: string; user_id: string }[] }),
    postIds.length > 0
      ? supabase.from("board_comments").select("post_id").in("post_id", postIds)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);

  const authorIds = [
    ...new Set([
      ...rows.map((p) => p.created_by),
      ...(followerRows ?? []).map((f) => f.user_id),
    ]),
  ];

  const { data: profiles } =
    authorIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", authorIds)
      : { data: [] as { id: string; name: string }[] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));
  const commentCountByPost = new Map<string, number>();
  for (const c of comments ?? []) {
    commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) ?? 0) + 1);
  }
  const followerNamesByPost = new Map<string, string[]>();
  for (const f of followerRows ?? []) {
    const list = followerNamesByPost.get(f.post_id) ?? [];
    list.push(nameById.get(f.user_id) ?? "알 수 없음");
    followerNamesByPost.set(f.post_id, list);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">게시판</h1>
        <Link
          href="/board/new"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand/30"
        >
          글쓰기
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">아직 등록된 글이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((post) => (
            <li key={post.id}>
              <Link
                href={`/board/${post.id}`}
                className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4"
              >
                <p className="truncate text-sm font-semibold">{post.title}</p>
                <p className="line-clamp-2 text-xs text-muted">{post.body}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                  <span>{nameById.get(post.created_by) ?? "알 수 없음"}</span>
                  <span>·</span>
                  <span>{timeAgoLabel(post.created_at)}</span>
                  {(commentCountByPost.get(post.id) ?? 0) > 0 && (
                    <>
                      <span>·</span>
                      <span>댓글 {commentCountByPost.get(post.id)}</span>
                    </>
                  )}
                  {(followerNamesByPost.get(post.id)?.length ?? 0) > 0 && (
                    <>
                      <span>·</span>
                      <span>Follower {followerNamesByPost.get(post.id)!.join(", ")}</span>
                    </>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
