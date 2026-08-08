"use client";

import { useState } from "react";
import type { FrequentAccount } from "@/lib/frequentAccounts";

export default function FrequentAccountsButton({
  accounts,
}: {
  accounts: FrequentAccount[];
}) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function handleCopy(acc: FrequentAccount) {
    try {
      await navigator.clipboard.writeText(acc.account_number);
      setCopiedKey(acc.account_number);
      setTimeout(() => setCopiedKey((k) => (k === acc.account_number ? null : k)), 1500);
    } catch {
      // 클립보드 접근 실패는 조용히 무시한다.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
      >
        📋 자주쓰는 계좌
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-2xl bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">자주쓰는 입금계좌</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-lg text-muted"
              >
                ✕
              </button>
            </div>

            {accounts.length === 0 ? (
              <p className="text-sm text-muted">
                아직 계좌번호를 입력한 입금요청 기록이 없습니다.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {accounts.map((acc) => (
                  <li
                    key={`${acc.vendor_name}-${acc.account_number}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{acc.vendor_name}</p>
                      <p className="truncate text-xs text-muted">
                        {acc.bank_name ? `${acc.bank_name} ` : ""}
                        {acc.account_number}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(acc)}
                      className="shrink-0 rounded-full border border-brand bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand"
                    >
                      {copiedKey === acc.account_number ? "복사됨 ✓" : "복사"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
