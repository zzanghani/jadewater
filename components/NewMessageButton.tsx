"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Profile = { id: string; name: string };

export default function NewMessageButton({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = profiles.filter((p) => p.name.includes(query));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand/30"
      >
        + 새 메시지
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">새 메시지</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-lg text-muted"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름으로 검색"
              autoFocus
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-brand/30 focus:ring-2"
            />
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-2 py-4 text-center text-sm text-muted">검색 결과가 없습니다.</li>
              ) : (
                filtered.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/messages/${p.id}`)}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-background"
                    >
                      {p.name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
