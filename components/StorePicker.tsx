"use client";

import { useState, useTransition } from "react";
import { claimStore } from "@/app/actions/auth";
import type { Store } from "@/lib/types";

export default function StorePicker({ stores }: { stores: Store[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handlePick(storeId: string) {
    setError(null);
    startTransition(async () => {
      const result = await claimStore(storeId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex min-h-dvh w-full flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold">소속 매장을 선택해 주세요</h1>
        <p className="mt-1 text-sm text-muted">처음 한 번만 선택하면 됩니다</p>
      </div>

      <div className="flex flex-col gap-2">
        {stores.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={pending}
            onClick={() => handlePick(s.id)}
            className="rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {s.name}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
