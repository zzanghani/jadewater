"use client";

import type { RefObject } from "react";

const TOGGLE_TITLE_PLACEHOLDER = "제목";
const TOGGLE_BODY_PLACEHOLDER = "내용을 입력하세요";

export default function ToggleInsertButton({
  textareaRef,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  function insertToggle() {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const needsLeadingNewline = start > 0 && el.value[start - 1] !== "\n";
    const template = `${needsLeadingNewline ? "\n" : ""}▶ ${TOGGLE_TITLE_PLACEHOLDER}\n${TOGGLE_BODY_PLACEHOLDER}\n◀\n`;

    const newValue = el.value.slice(0, start) + template + el.value.slice(end);

    // uncontrolled textarea라 DOM value를 직접 바꿔주면 폼 제출에도 그대로 반영된다.
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    setter?.call(el, newValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));

    const titleStart = start + (needsLeadingNewline ? 1 : 0) + 2;
    const titleEnd = titleStart + TOGGLE_TITLE_PLACEHOLDER.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(titleStart, titleEnd);
    });
  }

  return (
    <button
      type="button"
      onClick={insertToggle}
      className="self-start rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
    >
      ▶ 토글 삽입
    </button>
  );
}
