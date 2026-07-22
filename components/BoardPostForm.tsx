"use client";

import { useActionState, useRef, useState } from "react";
import { createBoardPost, type BoardFormState } from "@/app/(app)/board/actions";

export default function BoardPostForm() {
  const [state, formAction, pending] = useActionState<BoardFormState, FormData>(
    createBoardPost,
    undefined
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileNames(Array.from(e.target.files ?? []).map((f) => f.name));
  }

  function clearFiles() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileNames([]);
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        제목
        <input
          type="text"
          name="title"
          required
          placeholder="제목을 입력하세요"
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        내용
        <textarea
          name="body"
          required
          rows={6}
          placeholder="내용을 입력하세요"
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        파일/사진 첨부
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
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-4 text-sm font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
        >
          📎 파일 선택하기
        </button>
        {fileNames.length > 0 && (
          <div className="flex flex-col gap-1 rounded-xl bg-background px-3 py-2 text-xs text-muted">
            {fileNames.map((name) => (
              <span key={name} className="truncate">
                {name}
              </span>
            ))}
            <button
              type="button"
              onClick={clearFiles}
              className="self-start text-[11px] font-semibold text-red-600"
            >
              선택 지우기
            </button>
          </div>
        )}
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
      >
        {pending ? "등록 중..." : "등록"}
      </button>
    </form>
  );
}
