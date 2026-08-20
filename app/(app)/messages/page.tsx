import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import NewMessageButton from "@/components/NewMessageButton";
import { fetchAvatarUrlById } from "@/lib/avatar";
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

type Conversation = {
  otherId: string;
  lastBody: string;
  lastAt: string;
  unreadCount: number;
};

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: messages }, { data: allProfiles }] = await Promise.all([
    supabase
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("profiles").select("id, name").neq("id", user.id).order("name"),
  ]);

  // 상대방 계정 기준으로 묶어서, 가장 최근 메시지를 미리보기로 보여준다.
  const byOther = new Map<string, Conversation>();
  for (const m of messages ?? []) {
    const otherId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    const isUnreadForMe = m.recipient_id === user.id && !m.read_at;
    const existing = byOther.get(otherId);
    if (!existing) {
      byOther.set(otherId, {
        otherId,
        lastBody: m.body,
        lastAt: m.created_at,
        unreadCount: isUnreadForMe ? 1 : 0,
      });
    } else if (isUnreadForMe) {
      existing.unreadCount += 1;
    }
  }
  const conversations = [...byOther.values()].sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
  );

  const otherIds = conversations.map((c) => c.otherId);
  const [{ data: otherProfiles }, avatarById] = await Promise.all([
    otherIds.length > 0
      ? supabase.from("profiles").select("id, name").in("id", otherIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    fetchAvatarUrlById(supabase, otherIds),
  ]);
  const nameById = new Map((otherProfiles ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">메시지</h1>
          <Link
            href="/messages/rooms"
            className="text-xs font-medium text-muted underline-offset-2 hover:underline"
          >
            채팅방
          </Link>
        </div>
        <NewMessageButton profiles={allProfiles ?? []} />
      </div>

      {conversations.length === 0 ? (
        <p className="text-sm text-muted">아직 주고받은 메시지가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {conversations.map((c) => (
            <li key={c.otherId}>
              <Link
                href={`/messages/${c.otherId}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <Avatar
                  name={nameById.get(c.otherId) ?? "?"}
                  avatarUrl={avatarById.get(c.otherId)}
                  size={40}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {nameById.get(c.otherId) ?? "알 수 없음"}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted">
                      {timeAgoLabel(c.lastAt)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted">{c.lastBody}</p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                    {c.unreadCount}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
