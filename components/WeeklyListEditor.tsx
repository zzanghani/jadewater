"use client";

import { useState } from "react";

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return keySeq;
}

export default function WeeklyListEditor({
  fieldName,
  initial,
}: {
  fieldName: string;
  initial: string[];
}) {
  const [items, setItems] = useState(() =>
    (initial.length > 0 ? initial : [""]).map((text) => ({ key: nextKey(), text }))
  );

  function update(key: number, text: string) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, text } : i)));
  }
  function add() {
    setItems((prev) => [...prev, { key: nextKey(), text: "" }]);
  }
  function remove(key: number) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  const jsonValue = JSON.stringify(items.map((i) => i.text).filter((t) => t.trim()));

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={fieldName} value={jsonValue} readOnly />
      {items.map((item, idx) => (
        <div key={item.key} className="flex items-center gap-2">
          <span className="w-4 shrink-0 text-xs text-muted">{idx + 1}.</span>
          <input
            type="text"
            value={item.text}
            onChange={(e) => update(item.key, e.target.value)}
            placeholder="여기에 작성해주세요"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
          <button
            type="button"
            onClick={() => remove(item.key)}
            aria-label="삭제"
            className="shrink-0 rounded-lg p-1.5 text-muted hover:text-red-500"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="mt-1 w-full rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand"
      >
        + 항목 추가
      </button>
    </div>
  );
}
