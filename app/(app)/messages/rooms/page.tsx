import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateChatRoomButton from "@/components/CreateChatRoomButton";
import { kstDateTimeLabel } from "@/lib/date";

function timeAgoLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return kstDateTimeLabel(iso).split(" ")[0];
}

export default async function ChatRoomsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rooms } = await supabase
    .from("chat_rooms")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const roomIds = (rooms ?? []).map((r) => r.id);

  const [{ data: lastMessages }, { data: myMembership }] = await Promise.all([
    roomIds.length > 0
      ? supabase
          .from("chat_messages")
          .select("room_id, body, created_at")
          .in("room_id", roomIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { room_id: string; body: string; created_at: string }[] }),
    roomIds.length > 0
      ? supabase
          .from("chat_room_members")
          .select("room_id, last_read_at")
          .eq("user_id", user.id)
          .in("room_id", roomIds)
      : Promise.resolve({ data: [] as { room_id: string; last_read_at: string | null }[] }),
  ]);

  const lastMessageByRoom = new Map<string, { body: string; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!lastMessageByRoom.has(m.room_id)) lastMessageByRoom.set(m.room_id, m);
  }
  const lastReadByRoom = new Map((myMembership ?? []).map((m) => [m.room_id, m.last_read_at]));

  const sortedRooms = [...(rooms ?? [])].sort((a, b) => {
    const aTime = lastMessageByRoom.get(a.id)?.created_at ?? a.created_at;
    const bTime = lastMessageByRoom.get(b.id)?.created_at ?? b.created_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">채팅방</h1>
          <Link
            href="/messages"
            className="text-xs font-medium text-muted underline-offset-2 hover:underline"
          >
            1:1 메시지
          </Link>
        </div>
        <CreateChatRoomButton />
      </div>

      {sortedRooms.length === 0 ? (
        <p className="text-sm text-muted">아직 만들어진 채팅방이 없습니다. 새로 만들어보세요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sortedRooms.map((room) => {
            const last = lastMessageByRoom.get(room.id);
            const lastReadAt = lastReadByRoom.get(room.id);
            const hasUnread =
              !!last && (!lastReadAt || new Date(last.created_at) > new Date(lastReadAt));
            return (
              <li key={room.id}>
                <Link
                  href={`/messages/rooms/${room.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-base font-bold text-brand">
                    #
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{room.name}</p>
                      {last && (
                        <span className="shrink-0 text-[11px] text-muted">
                          {timeAgoLabel(last.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted">
                      {last?.body ?? "아직 메시지가 없습니다."}
                    </p>
                  </div>
                  {hasUnread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
