"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendRoomMessage, uploadInlineChatFile, type SendRoomMessageState } from "@/app/(app)/messages/rooms/actions";
import MediaInsertButton from "@/components/MediaInsertButton";

type Member = { id: string; name: string };

export default function RoomMessageForm({ roomId, members }: { roomId: string; members: Member[] }) {
  const [state, formAction, pending] = useActionState<SendRoomMessageState, FormData>(
    sendRoomMessage,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  useEffect(() => {
    if (!state?.success) return;
    formRef.current?.reset();
    setBody("");
  }, [state]);

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    const cursor = e.target.selectionStart ?? value.length;
    setBody(value);

    const uptoCursor = value.slice(0, cursor);
    const atIndex = uptoCursor.lastIndexOf("@");
    if (atIndex === -1) {
      setMentionQuery(null);
      setMentionStart(null);
      return;
    }
    const between = uptoCursor.slice(atIndex + 1);
    // "@" 뒤에 공백/줄바꿈이 나오면 태그 입력이 끝난 것으로 본다.
    if (/\s/.test(between)) {
      setMentionQuery(null);
      setMentionStart(null);
      return;
    }
    setMentionQuery(between);
    setMentionStart(atIndex);
  }

  function pickMention(name: string) {
    if (mentionStart === null || !textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart ?? body.length;
    const before = body.slice(0, mentionStart);
    const after = body.slice(cursor);
    const next = `${before}@${name} ${after}`;
    setBody(next);
    setMentionQuery(null);
    setMentionStart(null);
    requestAnimationFrame(() => {
      const pos = before.length + name.length + 2;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  const suggestions =
    mentionQuery !== null
      ? members.filter((m) => m.name.includes(mentionQuery)).slice(0, 5)
      : [];

  // 엔터로 바로 전송, 쉬프트+엔터는 줄바꿈. 태그 후보가 떠 있을 땐
  // 엔터가 전송 대신 첫 번째 후보를 고르게 한다. 한글 등 조합 중인
  // 엔터(예: 조합 확정용 엔터)까지 전송으로 잡아채면 안 되므로
  // isComposing과 구형 브라우저의 keyCode 229도 같이 확인한다.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    if (suggestions.length > 0) {
      pickMention(suggestions[0].name);
      return;
    }
    if (pending) return;
    formRef.current?.requestSubmit();
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-card/95 backdrop-blur">
      <form
        ref={formRef}
        action={formAction}
        className="mx-auto flex max-w-md flex-col gap-1.5 px-3 py-2"
      >
        <input type="hidden" name="room_id" value={roomId} />
        <div className="relative">
          {suggestions.length > 0 && (
            <ul className="absolute bottom-full left-0 z-10 mb-1 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              {suggestions.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => pickMention(m.name)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-background"
                  >
                    @{m.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <textarea
              ref={textareaRef}
              name="body"
              required
              rows={1}
              value={body}
              onChange={handleBodyChange}
              placeholder="메시지를 입력하세요 (@이름으로 태그)"
              onKeyDown={handleKeyDown}
              className="flex-1 resize-none rounded-full border border-border bg-background px-3.5 py-2 leading-tight text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand/30 disabled:opacity-60"
            >
              {pending ? "전송 중..." : "전송"}
            </button>
          </div>
        </div>
        <MediaInsertButton textareaRef={textareaRef} onUploaded={() => {}} uploadAction={uploadInlineChatFile} />
        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>
        )}
      </form>
    </div>
  );
}
