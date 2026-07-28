"use client";

import { useRef, useState, useTransition } from "react";
import { createTodo, deleteTodo, toggleTodo } from "@/app/(app)/plan/actions";
import type { MonthlyPlanTodo } from "@/lib/types";

export default function MonthlyPlanTodos({ todos }: { todos: MonthlyPlanTodo[] }) {
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    if (!content.trim()) return;
    const value = content;
    setContent("");
    startTransition(() => {
      createTodo(value);
    });
    inputRef.current?.focus();
  }

  const sorted = [...todos].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">할 일</h2>

      <div className="flex flex-col gap-1.5">
        {sorted.length === 0 && (
          <p className="text-sm text-muted">등록된 할 일이 없습니다.</p>
        )}
        {sorted.map((t) => (
          <div
            key={t.id}
            className="group flex items-center gap-2 rounded-xl border border-border px-3 py-2"
          >
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => toggleTodo(t.id, !t.done))}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${
                t.done
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-card text-transparent"
              }`}
              aria-label={t.done ? "완료 해제" : "완료 처리"}
            >
              ✓
            </button>
            <span
              className={`flex-1 text-sm ${
                t.done ? "text-muted line-through" : "text-foreground"
              }`}
            >
              {t.content}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => deleteTodo(t.id))}
              className="text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="삭제"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="할 일을 입력하세요"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending || !content.trim()}
          className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          추가
        </button>
      </div>
    </section>
  );
}
