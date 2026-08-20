"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendRoomMessage, uploadInlineChatFile, type SendRoomMessageState } from "@/app/(app)/messages/rooms/actions";
import MediaInsertButton from "@/components/MediaInsertButton";

export default function RoomMessageForm({ roomId }: { roomId: string }) {
  const [state, formAction, pending] = useActionState<SendRoomMessageState, FormData>(
    sendRoomMessage,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state?.error) return;
    formRef.current?.reset();
  }, [state]);

  // 엔터로 바로 전송, 쉬프트+엔터는 줄바꿈. 한글 등 조합 중인 엔터(예:
  // 조합 확정용 엔터)까지 전송으로 잡아채면 안 되므로 isComposing과
  // 구형 브라우저의 keyCode 229도 같이 확인한다.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    if (pending) return;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="room_id" value={roomId} />
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          name="body"
          required
          rows={2}
          placeholder="메시지를 입력하세요 (Shift+Enter로 줄바꿈)"
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/30 disabled:opacity-60"
        >
          {pending ? "전송 중..." : "전송"}
        </button>
      </div>
      <MediaInsertButton textareaRef={textareaRef} onUploaded={() => {}} uploadAction={uploadInlineChatFile} />
      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>
      )}
    </form>
  );
}
