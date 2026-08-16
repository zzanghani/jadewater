"use client";

import type { RefObject } from "react";

// 헤더 1줄 + 값 1줄짜리 최소 표 틀. "|칸|칸|" 줄이 연속되면 표로
// 인식되고(lib/boardBody.ts), 첫 줄이 헤더가 된다. 칸을 더 늘리고 싶으면
// 같은 형식으로 줄을 더 쓰면 된다.
const TABLE_TEMPLATE_HEADER = "항목";

export default function TableInsertButton({
  textareaRef,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  function insertTable() {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const needsLeadingNewline = start > 0 && el.value[start - 1] !== "\n";
    const template = `${needsLeadingNewline ? "\n" : ""}| ${TABLE_TEMPLATE_HEADER} | 값 |\n| 내용1 | 내용2 |\n`;

    const newValue = el.value.slice(0, start) + template + el.value.slice(end);

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    setter?.call(el, newValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));

    const headerStart = start + (needsLeadingNewline ? 1 : 0) + 2;
    const headerEnd = headerStart + TABLE_TEMPLATE_HEADER.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(headerStart, headerEnd);
    });
  }

  return (
    <button
      type="button"
      onClick={insertTable}
      className="self-start rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
    >
      ▦ 표 삽입
    </button>
  );
}
