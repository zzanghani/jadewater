"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createBoardComment,
  uploadInlineBoardFile,
  type BoardFormState,
} from "@/app/(app)/board/actions";

type Profile = { id: string; name: string };
type UploadedAttachment = { path: string; fileName: string; url: string; isImage: boolean };

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
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  useEffect(() => {
    if (!state?.success) return;
    formRef.current?.reset();
    setAttachments([]);
    setUploadError(null);
    setBody("");
  }, [state]);

  // 채팅과 같은 방식 — 고르는 즉시 올려서 결과(성공/사진인지)를 바로
  // 확인할 수 있게 하고, 댓글 등록 시점엔 이미 올라간 경로만 넘긴다.
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.set("file", file);
        const result = await uploadInlineBoardFile(formData);
        if ("error" in result) {
          setUploadError(result.error);
          continue;
        }
        setAttachments((prev) => [
          ...prev,
          { path: result.path, fileName: result.fileName, url: result.url, isImage: result.isImage },
        ]);
      }
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(path: string) {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
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

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div key={a.path} className="relative">
              {a.isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.url}
                  alt={a.fileName}
                  className="h-16 w-16 rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-border bg-background px-1 text-center text-[10px] font-medium text-muted">
                  📎
                  <span className="line-clamp-2 break-all">{a.fileName}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(a.path)}
                aria-label="첨부 제거"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
              >
                ✕
              </button>
              <input type="hidden" name="attachment_path" value={a.path} />
              <input type="hidden" name="attachment_name" value={a.fileName} />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.xlsx,.xls,.doc,.docx,.hwp"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
        >
          {uploading ? "업로드 중..." : "🖼️ 사진·파일 첨부"}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-brand/30 transition-opacity disabled:opacity-60"
        >
          {pending ? "등록 중..." : "댓글 등록"}
        </button>
      </div>

      {uploadError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{uploadError}</p>
      )}

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
