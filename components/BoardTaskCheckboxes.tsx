"use client";

import { useTransition } from "react";
import { toggleRequesterConfirm, toggleFollowerConfirm } from "@/app/(app)/board/actions";

type Follower = { userId: string; name: string; confirmed: boolean };

export default function BoardTaskCheckboxes({
  postId,
  requesterConfirmed,
  requesterName,
  canConfirmRequester,
  followers,
  currentUserId,
}: {
  postId: string;
  requesterConfirmed: boolean;
  requesterName: string;
  canConfirmRequester: boolean;
  followers: Follower[];
  currentUserId?: string;
}) {
  const [pending, startTransition] = useTransition();

  function toggle(kind: "requester" | "follower") {
    startTransition(() => {
      if (kind === "requester") toggleRequesterConfirm(postId);
      else toggleFollowerConfirm(postId);
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
      <button
        type="button"
        disabled={!canConfirmRequester || pending}
        onClick={() => toggle("requester")}
        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium transition-colors ${
          requesterConfirmed
            ? "border-brand bg-brand/10 text-brand"
            : "border-border bg-card text-muted"
        } ${!canConfirmRequester ? "opacity-70" : ""}`}
      >
        {requesterConfirmed ? "✅" : "⬜"} Order {requesterName}
      </button>

      {followers.map((f) => (
        <button
          key={f.userId}
          type="button"
          disabled={f.userId !== currentUserId || pending}
          onClick={() => toggle("follower")}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium transition-colors ${
            f.confirmed
              ? "border-brand bg-brand/10 text-brand"
              : "border-border bg-card text-muted"
          } ${f.userId !== currentUserId ? "opacity-70" : ""}`}
        >
          {f.confirmed ? "✅" : "⬜"} Follower {f.name}
        </button>
      ))}
    </div>
  );
}
