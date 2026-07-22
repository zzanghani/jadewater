"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createBoardComment, type BoardFormState } from "@/app/(app)/board/actions";

type Profile = { id: string; name: string };

export default function BoardCommentForm({
  postId,
  profiles,
}: {
  postId: string;
  profiles: Profile[];
}) {
  const [state, formAction, pending] = useActionState<BoardFormState, FormData>(
    createBoardComment,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  useEffect(() => {
    if (state) return;
    formRef.current?.reset();
    setFileNames([]);
    setBody("");
  }, [state]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileNames(Array.from(e.target.files ?? []).map((f) => f.name));
  }

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    const cursor = e.target.selectionStart ?? value.length;
    setBody(value);

    const uptoCursor = value.slice(0, cursor);
    const atIndex = uptoCursor.lastIndexOf("@");
    if (atIndex === -1) {
      setMentionQuery(null);
      setMentionStart(null);
      return;
    }
    const between = uptoCursor.slice(atIndex + 1);
    // "@" 뒤에 공백/줄바꿈이 나오면 태그 입력이 끝난 것으로 본다.
    if (/\s/.test(between)) {
      setMentionQuery(null);
      setMentionStart(null);
      return;
    }
    setMentionQuery(between);
    setMentionStart(atIndex);
  }

  function pickMention(name: string) {
    if (mentionStart === null || !textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart ?? body.length;
    const before = body.slice(0, mentionStart);
    const after = body.slice(cursor);
    const next = `${before}@${name} ${after}`;
    setBody(next);
    setMentionQuery(null);
    setMentionStart(null);
    requestAnimationFrame(() => {
      const pos = before.length + name.length + 2;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  const suggestions =
    mentionQuery !== null
      ? profiles.filter((p) => p.name.includes(mentionQuery)).slice(0, 5)
      : [];

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="post_id" value={postId} />

      <div className="relative">
        <textarea
          ref={textareaRef}
          name="body"
          required
          rows={3}
          value={body}
          onChange={handleBodyChange}
          placeholder="댓글을 입력하세요 (@이름 으로 태그)"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />

        {suggestions.length > 0 && (
          <ul className="absolute bottom-full left-0 z-10 mb-1 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {suggestions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pickMention(p.name)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-background"
                >
                  @{p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
