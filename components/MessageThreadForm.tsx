"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendDirectMessage, type MessageFormState } from "@/app/(app)/messages/actions";

export default function MessageThreadForm({ recipientId }: { recipientId: string }) {
  const [state, formAction, pending] = useActionState<MessageFormState, FormData>(
    sendDirectMessage,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.success) return;
    formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="recipient_id" value={recipientId} />
      <div className="flex items-end gap-2">
        <textarea
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
      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>
      )}
    </form>
  );
}
