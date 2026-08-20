import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import MarkRoomRead from "@/components/MarkRoomRead";
import RoomMessageForm from "@/components/RoomMessageForm";
import { fetchAvatarUrlById } from "@/lib/avatar";
import { parseInlineContent } from "@/lib/boardBody";
import { kstDateTimeLabel } from "@/lib/date";

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
  if (referencedPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("chat")
      .createSignedUrls(referencedPaths, 3600);
    for (const s of signedUrls ?? []) {
      if (s.signedUrl) urlByPath[s.path ?? ""] = s.signedUrl;
    }
  }

  const senderIds = [...new Set(rows.map((m) => m.sender_id))];
  const [{ data: senderProfiles }, avatarById] = await Promise.all([
    senderIds.length > 0
      ? supabase.from("profiles").select("id, name").in("id", senderIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    fetchAvatarUrlById(supabase, senderIds),
  ]);
  const nameById = new Map((senderProfiles ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-col gap-4">
      <MarkRoomRead roomId={roomId} />

      <Link
        href="/messages/rooms"
        className="flex items-center gap-1 text-sm font-medium text-muted"
      >
        <span aria-hidden>←</span> 채팅방
      </Link>

      <h1 className="text-base font-bold"># {room.name}</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">아직 메시지가 없습니다. 먼저 보내보세요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((m) => {
            const mine = m.sender_id === user.id;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[80%] flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
                  {!mine && (
                    <span className="flex items-center gap-1 px-1 text-[11px] font-semibold text-muted">
                      <Avatar
                        name={nameById.get(m.sender_id) ?? "?"}
                        avatarUrl={avatarById.get(m.sender_id)}
                        size={16}
                      />
                      {nameById.get(m.sender_id) ?? "알 수 없음"}
                    </span>
                  )}
                  <div
                    className={`flex flex-col gap-1.5 rounded-2xl px-4 py-2.5 ${
                      mine ? "bg-brand text-white" : "border border-border bg-card text-foreground"
                    }`}
                  >
                    {parseInlineContent(m.body).map((node, i) => {
                      if (node.kind === "image") {
                        const src = urlByPath[node.path];
                        return src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={src}
                            alt={node.alt}
                            className="max-w-full rounded-xl"
                          />
                        ) : (
                          <p key={i} className="text-sm">
                            [사진: {node.alt}]
                          </p>
                        );
                      }
                      if (node.kind === "file") {
                        const href = urlByPath[node.path];
                        return href ? (
                          <a
                            key={i}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold underline ${
                              mine ? "text-white" : "text-brand"
                            }`}
                          >
                            📎 {node.name}
                          </a>
                        ) : (
                          <p key={i} className="text-sm">
                            [파일: {node.name}]
                          </p>
                        );
                      }
                      const text = node.kind === "table" ? node.rows.map((r) => r.join(" ")).join("\n") : node.text;
                      return (
                        <p key={i} className="whitespace-pre-wrap text-sm">
                          {text}
                        </p>
                      );
                    })}
                    <span className={`self-end text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>
                      {kstDateTimeLabel(m.created_at)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <RoomMessageForm roomId={roomId} />
    </div>
  );
}
