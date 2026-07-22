"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createBoardComment, type BoardFormState } from "@/app/(app)/board/actions";

export default function BoardCommentForm({ postId }: { postId: string }) {
  const [state, formAction, pending] = useActionState<BoardFormState, FormData>(
    createBoardComment,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);

  useEffect(() => {
    if (state) return;
    formRef.current?.reset();
    setFileNames([]);
  }, [state]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileNames(Array.from(e.target.files ?? []).map((f) => f.name));
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="post_id" value={postId} />
      <textarea
        name="body"
        required
        rows={3}
        placeholder="댓글을 입력하세요"
        className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
      />

      <div className="flex items-center justify-between gap-2">
        <input
          ref={fileInputRef}
          type="file"
          name="attachments"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
        >
          📎 {fileNames.length > 0 ? `${fileNames.length}개 선택됨` : "파일 첨부"}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-brand/30 transition-opacity disabled:opacity-60"
        >
          {pending ? "등록 중..." : "댓글 등록"}
        </button>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
