"use client";

import { useState } from "react";
import type { RecentSupplier } from "@/lib/frequentSuppliers";

export default function RecentSuppliersButton({
  suppliers,
  onSelect,
}: {
  suppliers: RecentSupplier[];
  onSelect: (supplier: string) => void;
}) {
  const [open, setOpen] = useState(false);

  function handleSelect(supplier: string) {
    onSelect(supplier);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground"
      >
        📋 최근 거래처
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
              <h3 className="text-base font-bold">최근 입고 거래처</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-lg text-muted">
                ✕
              </button>
            </div>

            {suppliers.length === 0 ? (
              <p className="text-sm text-muted">아직 등록된 입고 내역이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {suppliers.map((s) => (
                  <li
                    key={s.supplier}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border p-3"
                  >
                    <p className="min-w-0 truncate text-sm font-semibold">{s.supplier}</p>
                    <button
                      type="button"
                      onClick={() => handleSelect(s.supplier)}
                      className="shrink-0 rounded-full border border-brand bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand"
                    >
                      확인
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
