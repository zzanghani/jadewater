"use client";

import { useState, useTransition } from "react";
import { saveBulkPaymentRequests, type BulkPaymentState } from "@/app/(app)/payment/actions";
import { formatAmountInput } from "@/lib/format";

type Row = {
  key: number;
  vendor_name: string;
  bank_name: string;
  account_number: string;
  amount: string;
};

const BLANK_ROW_COUNT = 20;

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return keySeq;
}

function blankRow(): Row {
  return { key: nextKey(), vendor_name: "", bank_name: "", account_number: "", amount: "" };
}

export default function MonthEndBulkPaymentModal({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkPaymentState>(undefined);

  function openModal() {
    setRows(Array.from({ length: BLANK_ROW_COUNT }, blankRow));
    setResult(undefined);
    setOpen(true);
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow()]);
  }

  function handleSubmit() {
    startTransition(async () => {
      const items = rows.map((r) => ({
        vendor_name: r.vendor_name,
        bank_name: r.bank_name,
        account_number: r.account_number,
        amount: Number(r.amount) || 0,
      }));
      const res = await saveBulkPaymentRequests(storeId, items);
      setResult(res);
      if (res?.success) {
        setRows((prev) => prev.filter((r) => !(Number(r.amount) > 0 && r.vendor_name.trim())));
      }
    });
  }

  const filledCount = rows.filter((r) => Number(r.amount) > 0 && r.vendor_name.trim()).length;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
      >
        🧾 월말입금표
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-hidden rounded-2xl bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">월말입금표</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-lg text-muted"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted">
              업체별 금액을 입력하고 한번에 등록하세요. 금액이 비어있는 항목은 제외됩니다.
            </p>

            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted">
                아래 "업체 추가"로 항목을 만들어 주세요.
              </p>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                {rows.map((r) => (
                  <div
                    key={r.key}
                    className="flex flex-col gap-1.5 rounded-xl border border-border p-2.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={r.vendor_name}
                        onChange={(e) => updateRow(r.key, { vendor_name: e.target.value })}
                        placeholder="품목"
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatAmountInput(r.amount)}
                        onChange={(e) =>
                          updateRow(r.key, { amount: e.target.value.replace(/[^0-9]/g, "") })
                        }
                        placeholder="금액"
                        className="w-36 shrink-0 rounded-lg border border-border bg-background px-2.5 py-2 text-right text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
                      />
                      <button
                        type="button"
                        onClick={() => removeRow(r.key)}
                        aria-label="삭제"
                        className="shrink-0 rounded-lg p-2 text-muted hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={r.bank_name}
                        onChange={(e) => updateRow(r.key, { bank_name: e.target.value })}
                        placeholder="은행명"
                        className="w-24 shrink-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
                      />
                      <input
                        type="text"
                        value={r.account_number}
                        onChange={(e) => updateRow(r.key, { account_number: e.target.value })}
                        placeholder="계좌번호"
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={addRow}
              className="rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand"
            >
              + 업체 추가
            </button>

            {result?.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {result.error}
              </p>
            )}
            {result?.success && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                {result.count}건 등록되었습니다.
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || filledCount === 0}
              className="rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
            >
              {pending ? "등록 중..." : `일괄 등록 (${filledCount}건)`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
