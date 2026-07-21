"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completePaymentRequest } from "@/app/(app)/payment/actions";
import { buildKakaoMessage } from "@/lib/kakao";
import { formatWon } from "@/lib/format";
import CopyButton from "@/components/CopyButton";
import type { PaymentRequest } from "@/lib/types";

type Row = PaymentRequest & { storeName?: string };

function requestDateLabel(createdAt: string) {
  return new Date(createdAt).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  });
}

export default function PaymentRequestList({
  requests,
  showStore,
}: {
  requests: Row[];
  showStore: boolean;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (requests.length === 0) {
    return <p className="text-sm text-muted">아직 등록된 요청이 없습니다.</p>;
  }

  function handleComplete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setPendingId(id);
    startTransition(async () => {
      await completePaymentRequest(id);
      router.refresh();
      setPendingId(null);
      setSelected((s) => (s?.id === id ? null : s));
    });
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4"
          >
            <button
              type="button"
              onClick={() => setSelected(r)}
              className="min-w-0 flex-1 text-left"
            >
              {showStore && r.storeName && (
                <p className="mb-0.5 text-[11px] font-semibold text-brand">
                  {r.storeName}
                </p>
              )}
              <p className="truncate text-sm font-semibold">
                {r.vendor_name}
              </p>
              <p className="text-xs text-muted">
                {formatWon(r.amount)} · {requestDateLabel(r.created_at)}
              </p>
            </button>
            <button
              type="button"
              onClick={(e) => handleComplete(r.id, e)}
              disabled={pendingId === r.id}
              className="shrink-0 rounded-full border border-brand bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition-opacity disabled:opacity-50"
            >
              {pendingId === r.id ? "처리 중..." : "요청완료"}
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-2xl bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">입금요청 상세</h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-lg text-muted"
              >
                ✕
              </button>
            </div>

            {showStore && selected.storeName && (
              <p className="text-sm font-semibold text-brand">
                {selected.storeName}
              </p>
            )}

            <div className="whitespace-pre-wrap rounded-2xl rounded-tl-none bg-[#FEE500]/90 px-4 py-3 text-sm leading-relaxed text-[#3c2f00]">
              {buildKakaoMessage({
                vendorName: selected.vendor_name,
                amount: selected.amount,
                bankName: selected.bank_name ?? undefined,
                accountNumber: selected.account_number ?? undefined,
                date: requestDateLabel(selected.created_at),
              })}
            </div>

            <div className="flex items-center gap-2">
              <CopyButton
                text={buildKakaoMessage({
                  vendorName: selected.vendor_name,
                  amount: selected.amount,
                  bankName: selected.bank_name ?? undefined,
                  accountNumber: selected.account_number ?? undefined,
                  date: requestDateLabel(selected.created_at),
                })}
              />
              <button
                type="button"
                onClick={(e) => handleComplete(selected.id, e)}
                disabled={pendingId === selected.id}
                className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
              >
                {pendingId === selected.id ? "처리 중..." : "요청완료"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
