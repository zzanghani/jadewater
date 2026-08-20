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

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="room_id" value={roomId} />
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          name="body"
          required
          rows={2}
          placeholder="메시지를 입력하세요"
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
