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
    // 닫는 줄(◀) 없이 넣는다 — 다음 토글이나 글 끝에서 자동으로 닫히므로
    // 지우면 안 되는 줄을 신경 쓸 필요가 없다.
    const template = `${needsLeadingNewline ? "\n" : ""}▶ ${TOGGLE_TITLE_PLACEHOLDER}\n${TOGGLE_BODY_PLACEHOLDER}\n`;

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

    // 제목을 쓰고 엔터를 치면, 바로 아래 줄에 있는 내용 placeholder를
    // 통째로 선택해 준다 — 선택된 상태라 다음 글자를 치는 순간 바로
    // 덮어써져서, 따로 클릭하고 드래그해서 지울 필요가 없다.
    function handleEnter(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      el!.removeEventListener("keydown", handleEnter);

      const titleLineEnd = el!.value.indexOf("\n", el!.selectionStart);
      if (titleLineEnd === -1) return;
      const bodyStart = titleLineEnd + 1;
      const bodyEnd = bodyStart + TOGGLE_BODY_PLACEHOLDER.length;
      if (el!.value.slice(bodyStart, bodyEnd) !== TOGGLE_BODY_PLACEHOLDER) return;

      e.preventDefault();
      requestAnimationFrame(() => {
        el!.setSelectionRange(bodyStart, bodyEnd);
      });
    }
    el.addEventListener("keydown", handleEnter);
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
