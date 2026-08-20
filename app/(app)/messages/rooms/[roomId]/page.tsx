import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import MarkRoomRead from "@/components/MarkRoomRead";
import RoomMessageForm from "@/components/RoomMessageForm";
import { fetchAvatarUrlById } from "@/lib/avatar";
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

  const senderIds = [...new Set((messages ?? []).map((m) => m.sender_id))];
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

      {(messages?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted">아직 메시지가 없습니다. 먼저 보내보세요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(messages ?? []).map((m) => {
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
                    className={`flex flex-col gap-0.5 rounded-2xl px-4 py-2.5 ${
                      mine ? "bg-brand text-white" : "border border-border bg-card text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{m.body}</p>
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
