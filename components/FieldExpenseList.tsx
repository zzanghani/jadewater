"use client";

import { useState } from "react";
import { formatWon } from "@/lib/format";
import type { FieldExpense } from "@/lib/types";

type Row = FieldExpense & { photoUrl?: string };

export default function FieldExpenseList({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<Row | null>(null);

  if (rows.length === 0) {
    return <p className="text-sm text-muted">아직 등록된 지출이 없습니다.</p>;
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelected(r)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left"
            >
              {r.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.photoUrl}
                  alt="영수증"
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-background text-lg">
                  🧾
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {r.description}
                </p>
                <p className="text-xs text-muted">
                  {r.date} · {r.category} · {r.payment_method}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold">
                {formatWon(r.amount)}
              </span>
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
              <h3 className="text-base font-bold">지출 상세</h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-lg text-muted"
              >
                ✕
              </button>
            </div>

            {selected.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.photoUrl}
                alt="영수증"
                className="w-full rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-xl bg-background text-3xl">
                🧾
              </div>
            )}

            <div className="flex flex-col gap-2 text-sm">
              <DetailRow label="구매내역" value={selected.description} />
              <DetailRow label="금액" value={formatWon(selected.amount)} />
              <DetailRow label="일자" value={selected.date} />
              <DetailRow label="대분류" value={selected.category} />
              <DetailRow label="결제수단" value={selected.payment_method} />
            </div>
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
