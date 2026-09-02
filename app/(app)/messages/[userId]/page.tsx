import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import MarkThreadRead from "@/components/MarkThreadRead";
import MessageThreadForm from "@/components/MessageThreadForm";
import { fetchAvatarUrlById } from "@/lib/avatar";
import { kstDateTimeLabel } from "@/lib/date";
import { storeShortLabel } from "@/lib/storeColors";

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: otherId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  if (otherId === user.id) notFound();

  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("id, name, store_id")
    .eq("id", otherId)
    .maybeSingle();
  if (!otherProfile) notFound();

  const { data: otherStore } = otherProfile.store_id
    ? await supabase.from("stores").select("name, short_label").eq("id", otherProfile.store_id).maybeSingle()
    : { data: null };
  const otherDisplayName = otherStore
    ? `${otherProfile.name} [${storeShortLabel(otherStore)}]`
    : otherProfile.name;

  const { data: messages } = await supabase
    .from("direct_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true })
    .limit(500);

  const avatarById = await fetchAvatarUrlById(supabase, [user.id, otherId]);

  return (
    <div className="flex flex-col gap-4">
      <MarkThreadRead otherUserId={otherId} />

      <Link href="/messages" className="flex items-center gap-1 text-sm font-medium text-muted">
        <span aria-hidden>←</span> 메시지
      </Link>

      <div className="flex items-center gap-2">
        <Avatar name={otherProfile.name} avatarUrl={avatarById.get(otherId)} size={28} />
        <h1 className="text-base font-bold">{otherDisplayName}</h1>
      </div>

      {(messages?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted">아직 주고받은 메시지가 없습니다. 먼저 보내보세요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(messages ?? []).map((m) => {
            const mine = m.sender_id === user.id;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex max-w-[80%] flex-col gap-0.5 rounded-2xl px-4 py-2.5 ${
                    mine ? "bg-brand text-white" : "border border-border bg-card text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                  <span className={`self-end text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>
                    {kstDateTimeLabel(m.created_at)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <MessageThreadForm recipientId={otherId} />
    </div>
  );
}
