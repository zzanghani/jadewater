"use client";

import type { RefObject } from "react";
import { TOGGLE_OPEN_PREFIX } from "@/lib/boardBody";

const TOGGLE_TITLE_PLACEHOLDER = "제목";
const TOGGLE_BODY_PLACEHOLDER = "내용을 입력하세요";
const TOGGLE_TITLE_LINE = `${TOGGLE_OPEN_PREFIX} ${TOGGLE_TITLE_PLACEHOLDER}`;

// 아직 안 건드린 placeholder 줄(제목 또는 내용) 위에 클릭해서 커서만
// 놓였다면, 그 줄 전체를 선택 상태로 바꿔준다 — 그래야 바로 이어서
// 타이핑했을 때 placeholder가 즉시 덮어써진다. 엔터로 다음 줄에 넘어갈
// 때와 똑같은 사용자 경험을 클릭으로 들어갔을 때도 주기 위함.
function selectPlaceholderLineIfAny(el: HTMLTextAreaElement) {
  const pos = el.selectionStart;
  const lineStart = el.value.lastIndexOf("\n", pos - 1) + 1;
  const lineEndRaw = el.value.indexOf("\n", pos);
  const lineEnd = lineEndRaw === -1 ? el.value.length : lineEndRaw;
  const line = el.value.slice(lineStart, lineEnd);

  if (line === TOGGLE_TITLE_LINE) {
    el.setSelectionRange(lineStart + TOGGLE_OPEN_PREFIX.length + 1, lineEnd);
  } else if (line === TOGGLE_BODY_PLACEHOLDER) {
    el.setSelectionRange(lineStart, lineEnd);
  }
}

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

    // 클릭으로 placeholder 줄에 들어간 경우도 똑같이 처리한다. 여러 번
    // 토글을 삽입해도 리스너가 중복으로 쌓이지 않게 한 번만 붙인다.
    if (!el.dataset.toggleClickBound) {
      el.dataset.toggleClickBound = "1";
      el.addEventListener("click", () => selectPlaceholderLineIfAny(el));
    }
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
