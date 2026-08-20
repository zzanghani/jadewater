"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { resolveChatFileUrls } from "@/app/(app)/messages/rooms/actions";
import Avatar from "@/components/Avatar";
import ChatImageBubble from "@/components/ChatImageBubble";
import { createClient } from "@/lib/supabase/client";
import { parseInlineContent } from "@/lib/boardBody";
import { kstDateTimeLabel } from "@/lib/date";

type ChatMessageRow = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export default function ChatMessageList({
  roomId,
  currentUserId,
  initialMessages,
  nameById,
  avatarById,
  urlByPath: initialUrlByPath,
  downloadUrlByPath: initialDownloadUrlByPath,
}: {
  roomId: string;
  currentUserId: string;
  initialMessages: ChatMessageRow[];
  nameById: Record<string, string>;
  avatarById: Record<string, string | null | undefined>;
  urlByPath: Record<string, string>;
  downloadUrlByPath: Record<string, string>;
}) {
  const [messages, setMessages] = useState<ChatMessageRow[]>(initialMessages);
  const [urlByPath, setUrlByPath] = useState<Record<string, string>>(initialUrlByPath);
  const [downloadUrlByPath, setDownloadUrlByPath] = useState<Record<string, string>>(
    initialDownloadUrlByPath
  );
  const seenIds = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));
  const scrollRef = useRef<HTMLUListElement>(null);
  const [boxHeight, setBoxHeight] = useState<number | null>(null);

  // 메시지 영역이 내용 길이에 따라 늘었다 줄었다 하면(짧은 대화 =
  // 빈틈, 긴 대화 = 고정된 입력창에 마지막 메시지가 가려짐) 화면마다
  // 다르게 보이는 문제가 있어서, 화면에 실제로 남는 공간을 재서 그
  // 높이를 그대로 쓴다 — 고정 입력창 + 하단 메뉴 높이만큼만 빼고.
  useLayoutEffect(() => {
    function recalc() {
      const el = scrollRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const RESERVED_BELOW_PX = 185; // 입력창(~96px) + 하단 메뉴(~80px) + 여유분
      setBoxHeight(Math.max(160, window.innerHeight - top - RESERVED_BELOW_PX));
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  // 새 메시지가 오면(내가 보낸 것 포함) 실시간 구독으로만 목록에
  // 추가한다 — 서버 revalidate로도 같이 넣으면 중복될 수 있어서, 이
  // 화면 안에서는 Realtime이 유일한 갱신 경로다.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // 구독을 걸기 전에 세션(JWT)이 브라우저 클라이언트에 완전히
    // 붙었는지 먼저 확인한다 — 그렇지 않으면 Realtime 소켓이 익명으로
    // 붙어서 RLS에 막혀 이벤트가 조용히 안 옴(에러 없이 그냥 안 옴).
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`chat_messages_room_${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `room_id=eq.${roomId}`,
          },
          async (payload) => {
            const row = payload.new as ChatMessageRow;
            if (seenIds.current.has(row.id)) return;
            seenIds.current.add(row.id);
            setMessages((prev) => [...prev, row]);

            const paths = parseInlineContent(row.body)
              .filter((n) => n.kind === "image" || n.kind === "file")
              .map((n) => (n as { path: string }).path);
            if (paths.length === 0) return;

            const resolved = await resolveChatFileUrls(paths);
            if (Object.keys(resolved).length === 0) return;
            setUrlByPath((prev) => {
              const next = { ...prev };
              for (const [path, r] of Object.entries(resolved)) next[path] = r.url;
              return next;
            });
            setDownloadUrlByPath((prev) => {
              const next = { ...prev };
              for (const [path, r] of Object.entries(resolved)) next[path] = r.downloadUrl;
              return next;
            });
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // 메시지가 늘어날 때마다 가장 아래(최신 메시지)로 자동 스크롤한다.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <ul
        ref={scrollRef}
        style={{ height: boxHeight ?? undefined }}
        className="flex flex-col justify-end overflow-y-auto"
      >
        <li className="text-sm text-muted">아직 메시지가 없습니다. 먼저 보내보세요.</li>
      </ul>
    );
  }

  return (
    <ul
      ref={scrollRef}
      style={{ height: boxHeight ?? undefined }}
      className="flex flex-col justify-end gap-2 overflow-y-auto pb-1"
    >
      {messages.map((m) => {
        const mine = m.sender_id === currentUserId;
        return (
          <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`flex max-w-[80%] flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
              {!mine && (
                <span className="flex items-center gap-1 px-1 text-[11px] font-semibold text-muted">
                  <Avatar name={nameById[m.sender_id] ?? "?"} avatarUrl={avatarById[m.sender_id]} size={16} />
                  {nameById[m.sender_id] ?? "알 수 없음"}
                </span>
              )}
              <div
                className={`flex flex-col gap-1.5 rounded-2xl px-4 py-2.5 ${
                  mine
                    ? "bg-blue-100 text-blue-950"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                {parseInlineContent(m.body).map((node, i) => {
                  if (node.kind === "image") {
                    const src = urlByPath[node.path];
                    const downloadHref = downloadUrlByPath[node.path];
                    return src && downloadHref ? (
                      <ChatImageBubble key={i} src={src} downloadHref={downloadHref} alt={node.alt} />
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
                          mine ? "text-blue-800" : "text-brand"
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
                  const text =
                    node.kind === "table" ? node.rows.map((r) => r.join(" ")).join("\n") : node.text;
                  return (
                    <p key={i} className="whitespace-pre-wrap text-sm">
                      {text}
                    </p>
                  );
                })}
                <span className={`self-end text-[10px] ${mine ? "text-blue-700/70" : "text-muted"}`}>
                  {kstDateTimeLabel(m.created_at)}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
