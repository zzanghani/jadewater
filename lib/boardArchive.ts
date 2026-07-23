import { createDriveFolder, uploadFileToDrive } from "@/lib/googleDrive";
import type { createClient } from "@/lib/supabase/server";

function dateTimeLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(
    2,
    "0"
  )}`;
}

export async function archiveBoardPostToDrive(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string
): Promise<{ folderLink: string; storagePaths: string[] }> {
  const { data: post, error: postError } = await supabase
    .from("board_posts")
    .select("*")
    .eq("id", postId)
    .single();
  if (postError || !post) throw new Error("게시글을 찾을 수 없습니다.");

  const [{ data: comments }, { data: followers }, { data: postAttachments }] = await Promise.all([
    supabase.from("board_comments").select("*").eq("post_id", postId).order("created_at"),
    supabase.from("board_post_followers").select("*").eq("post_id", postId),
    supabase.from("board_attachments").select("*").eq("post_id", postId),
  ]);

  const commentRows = comments ?? [];
  const commentIds = commentRows.map((c) => c.id);
  const { data: commentAttachments } = commentIds.length
    ? await supabase.from("board_attachments").select("*").in("comment_id", commentIds)
    : { data: [] as typeof postAttachments };

  const allUserIds = [
    ...new Set([
      post.created_by,
      ...(followers ?? []).map((f) => f.user_id),
      ...commentRows.map((c) => c.created_by),
    ]),
  ];
  const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", allUserIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  const folderName = `[${post.category}] ${post.title} (${dateTimeLabel(post.created_at).slice(0, 10)})`;
  const parentId = process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID || undefined;
  const folder = await createDriveFolder(folderName, parentId);

  const lines: string[] = [];
  lines.push(`[${post.category}] ${post.title}`);
  lines.push(`작성자: ${nameById.get(post.created_by) ?? "알 수 없음"}`);
  lines.push(`작성일: ${dateTimeLabel(post.created_at)}`);
  if ((followers ?? []).length > 0) {
    const followerLabel = (followers ?? [])
      .map((f) => `${nameById.get(f.user_id) ?? "알 수 없음"}(${f.confirmed ? "확인" : "미확인"})`)
      .join(", ");
    lines.push(`Order 확인: ${post.requester_confirmed ? "완료" : "미완료"}`);
    lines.push(`Follower: ${followerLabel}`);
  }
  lines.push("");
  lines.push("----------------------------------------");
  lines.push(post.body);
  lines.push("----------------------------------------");
  lines.push("");
  lines.push(`댓글 (${commentRows.length}개)`);
  lines.push("");
  commentRows.forEach((c, i) => {
    lines.push(`[${i + 1}] ${nameById.get(c.created_by) ?? "알 수 없음"} (${dateTimeLabel(c.created_at)})`);
    lines.push(c.body);
    lines.push("");
  });

  const summaryBuffer = Buffer.from(lines.join("\n"), "utf-8");
  await uploadFileToDrive({
    name: "요약.txt",
    mimeType: "text/plain",
    buffer: summaryBuffer,
    parentId: folder.id,
  });

  const allAttachments = [...(postAttachments ?? []), ...(commentAttachments ?? [])];
  const storagePaths: string[] = [];

  for (const attachment of allAttachments) {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("board")
      .download(attachment.storage_path);
    if (downloadError || !fileBlob) continue;

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    await uploadFileToDrive({
      name: attachment.file_name,
      mimeType: fileBlob.type || "application/octet-stream",
      buffer,
      parentId: folder.id,
    });
    storagePaths.push(attachment.storage_path);
  }

  return { folderLink: folder.webViewLink, storagePaths };
}
