"use client";

import { useState, useTransition } from "react";
import { archivePaymentRequestAction } from "@/app/(app)/payment/actions";

export default function PaymentArchiveButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (done || pending) return;
    if (
      !window.confirm(
        "이 요청을 구글드라이브로 옮기고 여기서는 삭제합니다. 되돌릴 수 없는데 계속할까요?"
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await archivePaymentRequestAction(requestId);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        setDone(true);
      }
    });
  }

  if (done) {
    return <span className="shrink-0 text-[11px] font-semibold text-brand">보관됨 ✓</span>;
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-full border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
      >
        {pending ? "보관 중..." : "구글드라이브로 보관"}
      </button>
      {error && <p className="max-w-[140px] text-right text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
