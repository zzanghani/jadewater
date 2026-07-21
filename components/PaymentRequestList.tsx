"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completePaymentRequest } from "@/app/(app)/payment/actions";
import { formatWon } from "@/lib/format";
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
  isMaster,
}: {
  requests: Row[];
  isMaster: boolean;
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
              {isMaster && r.storeName && (
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
            {isMaster && (
              <button
                type="button"
                onClick={(e) => handleComplete(r.id, e)}
                disabled={pendingId === r.id}
                className="shrink-0 rounded-full border border-brand bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition-opacity disabled:opacity-50"
              >
                {pendingId === r.id ? "처리 중..." : "요청완료"}
              </button>
            )}
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

            {isMaster && selected.storeName && (
              <p className="text-sm font-semibold text-brand">
                {selected.storeName}
              </p>
            )}

            <div className="flex flex-col gap-2 text-sm">
              <DetailRow label="거래처" value={selected.vendor_name} />
              <DetailRow label="금액" value={formatWon(selected.amount)} />
              {selected.bank_name && (
                <DetailRow label="은행" value={selected.bank_name} />
              )}
              {selected.account_number && (
                <CopyableDetailRow
                  label="계좌번호"
                  value={selected.account_number}
                />
              )}
              <DetailRow
                label="요청일"
                value={requestDateLabel(selected.created_at)}
              />
            </div>

            {isMaster && (
              <button
                type="button"
                onClick={(e) => handleComplete(selected.id, e)}
                disabled={pendingId === selected.id}
                className="rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
              >
                {pendingId === selected.id ? "처리 중..." : "요청완료"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function CopyableDetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center justify-between border-b border-border/60 pb-2 text-left last:border-0"
    >
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-brand">
        {copied ? "복사됨 ✓" : value}
      </span>
    </button>
  );
}
