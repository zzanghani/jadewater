"use client";

import { useActionState, useState } from "react";
import { updateBoardPost, type BoardFormState } from "@/app/(app)/board/actions";
import BoardTaskCheckboxes from "@/components/BoardTaskCheckboxes";
import BoardBody from "@/components/BoardBody";
import BoardContentEditor from "@/components/BoardContentEditor";
import BoardDeleteButton from "@/components/BoardDeleteButton";
import Avatar from "@/components/Avatar";

type Follower = { userId: string; name: string; confirmed: boolean };
type Profile = { id: string; name: string };

const HAS_RICH_CONTENT = /[▶]|!\[.*\]\(.*\)|\[📎|^\|.*\|$/m;

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
  allProfiles,
  urlByPath = {},
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
  allProfiles: Profile[];
  urlByPath?: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<BoardFormState, FormData>(
    updateBoardPost,
    undefined
  );
  const [followerIds, setFollowerIds] = useState<string[]>(() => followers.map((f) => f.userId));
  const [bodyPreview, setBodyPreview] = useState(body);
  const [previewUrlByPath, setPreviewUrlByPath] = useState<Record<string, string>>(urlByPath);

  function toggleFollower(id: string) {
    setFollowerIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

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
        <BoardContentEditor
          name="body"
          initialBody={body}
          onSerializedChange={setBodyPreview}
          onUploaded={(path, url) => setPreviewUrlByPath((prev) => ({ ...prev, [path]: url }))}
        />
        {HAS_RICH_CONTENT.test(bodyPreview) && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border bg-card p-3">
            <p className="text-xs font-semibold text-muted">미리보기</p>
            <BoardBody body={bodyPreview} urlByPath={previewUrlByPath} mentionNames={allProfiles.map((p) => p.name)} />
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 text-sm">
          <p className="text-xs font-semibold text-muted">Order 확인 체크 수정</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="requester_confirmed" defaultChecked={requesterConfirmed} />
            Order {requesterName}
          </label>
        </div>

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          Follower{" "}
          <span className="font-normal text-muted">
            (꺼진 팔로워는 완전히 빠지고, 체크 여부와 상관없이 글이 완료로 넘어가지 않음)
          </span>
          <div className="flex flex-wrap gap-2">
            {allProfiles.map((p) => {
              const selected = followerIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleFollower(p.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selected
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-card text-muted"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          {followerIds.map((id) => (
            <input key={id} type="hidden" name="follower_ids" value={id} />
          ))}
        </div>

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
            {(isMaster || canConfirmRequester) && <BoardDeleteButton postId={postId} />}
          </div>
          <h1 className="mt-1.5 text-lg font-bold">{title}</h1>
          <p className="mt-1 flex items-center gap-2 text-2xl text-muted">
            <Avatar name={requesterName} avatarUrl={authorAvatarUrl} size={32} />
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
      <BoardBody body={body} urlByPath={urlByPath} mentionNames={allProfiles.map((p) => p.name)} />
    </>
  );
}
