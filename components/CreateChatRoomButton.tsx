"use client";

import { useActionState, useState } from "react";
import { createChatRoom, type RoomFormState } from "@/app/(app)/messages/rooms/actions";

export default function CreateChatRoomButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<RoomFormState, FormData>(
    createChatRoom,
    undefined
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand/30"
      >
        + 새 채팅방
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            action={formAction}
            className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">새 채팅방 만들기</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-lg text-muted"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              name="name"
              required
              autoFocus
              placeholder="채팅방 이름"
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-brand/30 focus:ring-2"
            />
            {state?.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/30 disabled:opacity-60"
              >
                {pending ? "만드는 중..." : "만들기"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
