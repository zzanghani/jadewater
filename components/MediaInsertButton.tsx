"use client";

import { useRef, useState, type RefObject } from "react";
import { uploadInlineBoardFile } from "@/app/(app)/board/actions";

// 커서가 있던 자리에 텍스트를 끼워 넣는다. 토글 삽입과 같은 방식으로
// uncontrolled textarea의 DOM value를 직접 바꾸고 input 이벤트를 흘려서
// 폼 제출·미리보기(onChange)에 그대로 반영되게 한다.
function insertAtCursor(el: HTMLTextAreaElement, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const needsLeadingNewline = start > 0 && el.value[start - 1] !== "\n";
  const insertion = `${needsLeadingNewline ? "\n" : ""}${text}\n`;
  const newValue = el.value.slice(0, start) + insertion + el.value.slice(end);

  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  setter?.call(el, newValue);
  el.dispatchEvent(new Event("input", { bubbles: true }));

  const cursorPos = start + insertion.length;
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(cursorPos, cursorPos);
  });
}

export default function MediaInsertButton({
  textareaRef,
  onUploaded,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onUploaded: (path: string, url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadInlineBoardFile(formData);

      if ("error" in result) {
        setError(result.error);
        return;
      }

      onUploaded(result.path, result.url);
      const el = textareaRef.current;
      if (el) {
        const reference = result.isImage
          ? `![${result.fileName}](${result.path})`
          : `[📎 ${result.fileName}](${result.path})`;
        insertAtCursor(el, reference);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.xlsx,.xls,.doc,.docx,.hwp"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="self-start rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
      >
        {uploading ? "업로드 중..." : "🖼️ 사진·파일 삽입"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
