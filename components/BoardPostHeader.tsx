"use client";

import { useActionState, useState } from "react";
import { updateBoardPost, type BoardFormState } from "@/app/(app)/board/actions";
import BoardTaskCheckboxes from "@/components/BoardTaskCheckboxes";
import Avatar from "@/components/Avatar";

type Follower = { userId: string; name: string; confirmed: boolean };

export default function BoardPostHeader({
  postId,
  category,
  title,
  body,
  authorLabel,
  authorAvatarUrl,
  isMaster,
  followers,
  requesterConfirmed,
  requesterName,
  canConfirmRequester,
  currentUserId,
}: {
  postId: string;
  category: string;
  title: string;
  body: string;
  authorLabel: string;
  authorAvatarUrl?: string | null;
  isMaster: boolean;
  followers: Follower[];
  requesterConfirmed: boolean;
  requesterName: string;
  canConfirmRequester: boolean;
  currentUserId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<BoardFormState, FormData>(
    updateBoardPost,
    undefined
  );

  if (editing) {
    return (
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="post_id" value={postId} />
        <span className="inline-block w-fit rounded-full bg-brand-light px-2.5 py-0.5 text-[11px] font-semibold text-brand">
          {category}
        </span>
        <input
          type="text"
          name="title"
          required
          defaultValue={title}
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold outline-none ring-brand/30 focus:ring-2"
        />
        <textarea
          name="body"
          required
          rows={6}
          defaultValue={body}
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-brand/30 focus:ring-2"
        />
        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/30 disabled:opacity-60"
          >
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block rounded-full bg-brand-light px-2.5 py-0.5 text-[11px] font-semibold text-brand">
              {category}
            </span>
            {isMaster && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs font-semibold text-muted"
              >
                수정
              </button>
            )}
          </div>
          <h1 className="mt-1.5 text-lg font-bold">{title}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <Avatar name={requesterName} avatarUrl={authorAvatarUrl} size={16} />
            {authorLabel}
          </p>
        </div>
        {followers.length > 0 && (
          <BoardTaskCheckboxes
            postId={postId}
            requesterConfirmed={requesterConfirmed}
            requesterName={requesterName}
            canConfirmRequester={canConfirmRequester}
            followers={followers}
            currentUserId={currentUserId}
          />
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{body}</p>
    </>
  );
}
