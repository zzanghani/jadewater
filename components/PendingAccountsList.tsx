"use client";

import { useState, useTransition } from "react";
import { approveAccount, rejectAccount } from "@/app/(app)/accounts/actions";
import { kstDateTimeLabel } from "@/lib/date";

type PendingAccount = { id: string; name: string; email: string; created_at: string };

export default function PendingAccountsList({ accounts }: { accounts: PendingAccount[] }) {
  const [items, setItems] = useState(accounts);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handle(id: string, action: (userId: string) => Promise<{ error?: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await action(id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((a) => a.id !== id));
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">대기 중인 가입 신청이 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
            <p className="truncate text-xs text-muted">{a.email}</p>
            <p className="text-[11px] text-muted">{kstDateTimeLabel(a.created_at)} 가입</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => handle(a.id, rejectAccount)}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted disabled:opacity-60"
            >
              거절
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handle(a.id, approveAccount)}
              className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              승인
            </button>
          </div>
        </div>
      ))}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
