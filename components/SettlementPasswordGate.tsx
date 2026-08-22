"use client";

import { useActionState, useEffect, useState } from "react";
import { unlockSettlement } from "@/app/(app)/settlement/actions";

export default function SettlementPasswordGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(unlockSettlement, undefined);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (state?.success) setUnlocked(true);
  }, [state]);

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <div>
        <h1 className="text-lg font-bold">월말정산 잠금</h1>
        <p className="mt-1 text-sm text-muted">비밀번호를 입력하면 확인할 수 있습니다.</p>
      </div>

      <form action={formAction} className="flex w-full flex-col gap-3">
        <input
          type="password"
          name="password"
          required
          autoFocus
          placeholder="비밀번호"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
        >
          {pending ? "확인 중..." : "확인"}
        </button>
      </form>
    </div>
  );
}
