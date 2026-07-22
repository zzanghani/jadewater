"use client";

import { useTransition } from "react";
import { toggleBoardTaskConfirm } from "@/app/(app)/board/actions";

export default function BoardTaskCheckboxes({
  postId,
  requesterConfirmed,
  assigneeConfirmed,
  requesterName,
  assigneeName,
  canConfirmRequester,
  canConfirmAssignee,
}: {
  postId: string;
  requesterConfirmed: boolean;
  assigneeConfirmed: boolean;
  requesterName: string;
  assigneeName: string;
  canConfirmRequester: boolean;
  canConfirmAssignee: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function toggle(role: "requester" | "assignee") {
    startTransition(() => {
      toggleBoardTaskConfirm(postId, role);
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
      <button
        type="button"
        disabled={!canConfirmAssignee || pending}
        onClick={() => toggle("assignee")}
        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium transition-colors ${
          assigneeConfirmed
            ? "border-brand bg-brand/10 text-brand"
            : "border-border bg-card text-muted"
        } ${!canConfirmAssignee ? "opacity-70" : ""}`}
      >
        {assigneeConfirmed ? "✅" : "⬜"} Follower {assigneeName}
      </button>
    </div>
  );
}
