"use client";

import { useTransition } from "react";
import { deletePlanComment, togglePlanFollowerConfirm } from "@/app/(app)/plan/actions";
import MonthlyPlanCommentForm from "@/components/MonthlyPlanCommentForm";
import BoardAttachmentList from "@/components/BoardAttachmentList";

type Attachment = { id: string; file_name: string; url?: string };

export type PlanComment = {
  id: string;
  body: string;
  created_by: string;
  created_at: string;
  authorName: string;
  attachments: Attachment[];
};

export type PlanFollower = {
  userId: string;
  name: string;
  confirmed: boolean;
};

function dateTimeLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export default function MonthlyPlanDetail({
  planId,
  description,
  followers = [],
  comments,
  currentUserId,
}: {
  planId: string;
  description?: string | null;
  followers?: PlanFollower[];
  comments: PlanComment[];
  currentUserId?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-background p-3">
      {description && (
        <p className="whitespace-pre-wrap rounded-lg border border-border bg-card p-2.5 text-sm text-foreground">
          {description}
        </p>
      )}

      {followers.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5">
          <p className="text-xs font-semibold text-foreground">담당자 확인</p>
          <div className="flex flex-wrap gap-1.5">
            {followers.map((f) => {
              const isMe = f.userId === currentUserId;
              return (
                <button
                  key={f.userId}
                  type="button"
                  disabled={!isMe || pending}
                  onClick={() => isMe && startTransition(() => togglePlanFollowerConfirm(planId))}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    f.confirmed
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-background text-muted"
                  } ${!isMe ? "opacity-70" : ""}`}
                >
                  {f.confirmed ? "✅" : "⬜"} {f.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-xs text-muted">아직 댓글이나 첨부파일이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">{dateTimeLabel(c.created_at)}</span>
                  {c.created_by === currentUserId && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => startTransition(() => deletePlanComment(c.id))}
                      className="text-[10px] text-muted"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
              {c.body && <p className="whitespace-pre-wrap text-sm text-foreground">{c.body}</p>}
              <BoardAttachmentList attachments={c.attachments} />
            </div>
          ))}
        </div>
      )}

      <MonthlyPlanCommentForm planId={planId} />
    </div>
  );
}
