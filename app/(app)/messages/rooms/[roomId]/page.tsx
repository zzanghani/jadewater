import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import ChatMessageList from "@/components/ChatMessageList";
import MarkRoomRead from "@/components/MarkRoomRead";
import RoomMessageForm from "@/components/RoomMessageForm";
import { fetchAvatarUrlById } from "@/lib/avatar";
import { parseInlineContent } from "@/lib/boardBody";

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: room } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) notFound();

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(500);

  const rows = messages ?? [];

  // 메시지 안에 사진/파일로 참조된 스토리지 경로를 전부 모아서
  // 한 번에 서명된 URL을 발급받는다(게시판과 달리 첨부 전용 테이블
  // 없이, 참조된 경로 그대로 매번 다시 서명한다).
  const referencedPaths = [
    ...new Set(
      rows.flatMap((m) =>
        parseInlineContent(m.body)
          .filter((n) => n.kind === "image" || n.kind === "file")
          .map((n) => (n as { path: string }).path)
      )
    ),
  ];
  const urlByPath: Record<string, string> = {};
  const downloadUrlByPath: Record<string, string> = {};
  if (referencedPaths.length > 0) {
    const [{ data: signedUrls }, { data: downloadSignedUrls }] = await Promise.all([
      supabase.storage.from("chat").createSignedUrls(referencedPaths, 3600),
      // 사진 팝업의 "다운로드" 버튼용 — Content-Disposition을 attachment로
      // 붙여야 <a download>가 안 먹는 다른 도메인 URL에서도 실제로
      // 다운로드된다. 미리보기용 URL은 그대로 인라인으로 열려야 하므로
      // 서명을 따로 받는다.
      supabase.storage.from("chat").createSignedUrls(referencedPaths, 3600, { download: true }),
    ]);
    for (const s of signedUrls ?? []) {
      if (s.signedUrl) urlByPath[s.path ?? ""] = s.signedUrl;
    }
    for (const s of downloadSignedUrls ?? []) {
      if (s.signedUrl) downloadUrlByPath[s.path ?? ""] = s.signedUrl;
    }
  }

  const { data: memberRows } = await supabase
    .from("chat_room_members")
    .select("user_id")
    .eq("room_id", roomId);
  const memberIds = (memberRows ?? []).map((m) => m.user_id);

  const senderIds = rows.map((m) => m.sender_id);
  const profileIds = [...new Set([...memberIds, ...senderIds])];
  const [{ data: profiles }, avatarById] = await Promise.all([
    profileIds.length > 0
      ? supabase.from("profiles").select("id, name").in("id", profileIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    fetchAvatarUrlById(supabase, profileIds),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));
  const members = memberIds.map((id) => ({ id, name: nameById.get(id) ?? "알 수 없음" }));

  return (
    <div className="flex flex-col gap-4">
      <MarkRoomRead roomId={roomId} />

      <Link
        href="/messages/rooms"
        className="flex items-center gap-1 text-sm font-medium text-muted"
      >
        <span aria-hidden>←</span> 채팅방
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-base font-bold"># {room.name}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted">참여자 {members.length}명</span>
          {members.map((m) => (
            <span
              key={m.id}
              className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground"
            >
              <Avatar name={m.name} avatarUrl={avatarById.get(m.id)} size={14} />
              {m.name}
            </span>
          ))}
        </div>
      </div>

      <ChatMessageList
        roomId={roomId}
        currentUserId={user.id}
        initialMessages={rows}
        nameById={Object.fromEntries(nameById)}
        avatarById={Object.fromEntries(avatarById)}
        urlByPath={urlByPath}
        downloadUrlByPath={downloadUrlByPath}
      />

      {/* 아래 고정된 입력창에 마지막 내용이 가리지 않도록 여백만 확보 */}
      <div className="h-32" aria-hidden />
      <RoomMessageForm roomId={roomId} />
    </div>
  );
}
