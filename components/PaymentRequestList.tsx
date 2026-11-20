"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completePaymentRequest, reopenPaymentRequest } from "@/app/(app)/payment/actions";
import { formatWon } from "@/lib/format";
import { kstDateString } from "@/lib/date";
import { storeColorSoft } from "@/lib/storeColors";
import PaymentArchiveButton from "@/components/PaymentArchiveButton";
import type { PaymentRequest } from "@/lib/types";

type Row = PaymentRequest & {
  storeName?: string;
  storeColor?: string;
  isTeamRequest?: boolean;
  teamDepartmentLabel?: string;
};

function kstDateParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function requestDateLabel(iso: string) {
  const { m, d } = kstDateParts(iso);
  return `${m}월 ${d}일`;
}

// 요청일(KST 달력 날짜) 기준으로 오늘까지 며칠 지났는지. 당일이면 0.
function daysSinceRequest(iso: string): number {
  const { y, m, d } = kstDateParts(iso);
  const requestUTC = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = kstDateString(0).split("-").map(Number);
  const todayUTC = Date.UTC(ty, tm - 1, td);
  return Math.round((todayUTC - requestUTC) / 86_400_000);
}

export default function PaymentRequestList({
  requests,
  isMaster,
  showDone = false,
}: {
  requests: Row[];
  isMaster: boolean;
  showDone?: boolean;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reopenError, setReopenError] = useState<{ id: string; message: string } | null>(null);
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

  // 실수로 완료 처리한 요청을 진행중으로 되돌린다 (마스터, 완료 목록에서만).
  function handleReopen(r: Row, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`${r.vendor_name} ${formatWon(r.amount)} 요청을 '진행중'으로 되돌릴까요?\n아직 입금하지 않은 경우에만 눌러 주세요.`)) return;
    setReopenError(null);
    setPendingId(r.id);
    startTransition(async () => {
      const res = await reopenPaymentRequest(r.id);
      if (res.error) setReopenError({ id: r.id, message: res.error });
      router.refresh();
      setPendingId(null);
      if (!res.error) setSelected((s) => (s?.id === r.id ? null : s));
    });
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {requests.map((r) => {
          const days = daysSinceRequest(r.created_at);
          const isUrgent = !showDone && days >= 3;
          return (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4"
            >
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="min-w-0 flex-1 text-left"
              >
                {isMaster && r.isTeamRequest && r.teamDepartmentLabel ? (
                  <p className="mb-0.5 text-[11px] font-semibold text-blue-600">
                    {r.teamDepartmentLabel}
                  </p>
                ) : (
                  isMaster &&
                  r.storeName && (
                    <p
                      className="mb-0.5 text-[11px] font-semibold"
                      style={{ color: storeColorSoft({ name: r.storeName, color: r.storeColor }) }}
                    >
                      {r.storeName}
                    </p>
                  )
                )}
                <p
                  className={`truncate text-sm font-semibold ${
                    isMaster && r.isTeamRequest ? "text-blue-600" : ""
                  }`}
                >
                  {r.vendor_name}
                  {r.is_payroll && (
                    <span className="ml-1.5 rounded-md bg-brand-light px-1.5 py-0.5 align-middle text-[10px] font-semibold text-brand">
                      급여
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {formatWon(r.amount)} · {requestDateLabel(r.created_at)}
                  {days >= 1 && (
                    <span
                      className={`font-semibold ${
                        isUrgent ? "text-red-600" : "text-amber-600"
                      }`}
                    >
                      {" · "}
                      D+{days}
                    </span>
                  )}
                </p>
              </button>
              {isUrgent && <UrgentBadge />}
              {isMaster && showDone && (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => handleReopen(r, e)}
                    disabled={pendingId === r.id}
                    className="rounded-full border border-amber-500 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 transition-opacity disabled:opacity-50"
                  >
                    {pendingId === r.id ? "되돌리는 중..." : "↩ 진행중으로 되돌리기"}
                  </button>
                  <PaymentArchiveButton requestId={r.id} />
                  {reopenError?.id === r.id && <p className="max-w-[150px] text-right text-[10px] text-red-600">{reopenError.message}</p>}
                </div>
              )}
              {isMaster && !showDone && (
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
          );
        })}
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

            {isMaster && selected.isTeamRequest && selected.teamDepartmentLabel ? (
              <p className="text-sm font-semibold text-blue-600">
                {selected.teamDepartmentLabel}
              </p>
            ) : (
              isMaster &&
              selected.storeName && (
                <p
                  className="text-sm font-semibold"
                  style={{ color: storeColorSoft({ name: selected.storeName, color: selected.storeColor }) }}
                >
                  {selected.storeName}
                </p>
              )
            )}

            <div className="flex flex-col gap-2 text-sm">
              <DetailRow
                label="거래처"
                value={selected.vendor_name}
                valueClassName={
                  isMaster && selected.isTeamRequest ? "text-blue-600" : undefined
                }
              />
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
                value={
                  requestDateLabel(selected.created_at) +
                  (daysSinceRequest(selected.created_at) >= 1
                    ? ` (D+${daysSinceRequest(selected.created_at)})`
                    : "")
                }
              />
            </div>

            {daysSinceRequest(selected.created_at) >= 3 && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                🚨 긴급: 요청일로부터{" "}
                {daysSinceRequest(selected.created_at)}일 경과했습니다
              </div>
            )}

            {isMaster && showDone && (
              <button
                type="button"
                onClick={(e) => handleReopen(selected, e)}
                disabled={pendingId === selected.id}
                className="rounded-xl border border-amber-500 bg-amber-50 py-3 text-sm font-semibold text-amber-700 transition-opacity disabled:opacity-60"
              >
                {pendingId === selected.id ? "되돌리는 중..." : "↩ 진행중으로 되돌리기 (입금 전)"}
              </button>
            )}
            {isMaster && showDone && reopenError?.id === selected.id && <p className="text-xs text-red-600">{reopenError.message}</p>}

            {isMaster && !showDone && (
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

function UrgentBadge() {
  return (
    <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-600">
      🚨 긴급
    </span>
  );
}

function DetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
      <span className="text-muted">{label}</span>
      <span className={`font-semibold ${valueClassName ?? ""}`}>{value}</span>
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
