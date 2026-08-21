"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameSupplier } from "@/app/(app)/receipts/actions";
import type { RecentSupplier } from "@/lib/frequentSuppliers";

export default function RecentSuppliersButton({
  storeId,
  suppliers,
  onSelect,
}: {
  storeId: string;
  suppliers: RecentSupplier[];
  onSelect: (supplier: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(suppliers);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSelect(supplier: string) {
    onSelect(supplier);
    setOpen(false);
  }

  function startEdit(supplier: string) {
    setEditing(supplier);
    setEditValue(supplier);
    setError(null);
  }

  function saveEdit(oldName: string) {
    const newName = editValue.trim();
    if (!newName || newName === oldName) {
      setEditing(null);
      return;
    }
    startTransition(async () => {
      const result = await renameSupplier(storeId, oldName, newName);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // 같은 이름으로 합쳐진 항목이 있으면 하나로 묶고, 목록에서
      // 새로고침 없이 바로 이름이 바뀐 걸로 보이게 한다.
      setItems((prev) => {
        const next = prev.filter((s) => s.supplier !== oldName && s.supplier !== newName);
        const merged = prev.find((s) => s.supplier === oldName);
        const existing = prev.find((s) => s.supplier === newName);
        if (merged) {
          next.push({
            supplier: newName,
            lastUsedAt: merged.lastUsedAt,
            count: merged.count + (existing?.count ?? 0),
          });
        }
        return next.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
      });
      setEditing(null);
      router.refresh();
    });
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

            <p className="text-xs text-muted">
              이름이 잘못 등록된 거래처는 ✏️로 고치면 과거 입고 내역까지 한번에 합쳐집니다.
            </p>

            {items.length === 0 ? (
              <p className="text-sm text-muted">아직 등록된 입고 내역이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((s) =>
                  editing === s.supplier ? (
                    <li
                      key={s.supplier}
                      className="flex items-center gap-2 rounded-xl border border-brand p-3"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none ring-brand/30 focus:ring-2"
                      />
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => saveEdit(s.supplier)}
                        className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {pending ? "저장 중..." : "저장"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted"
                      >
                        취소
                      </button>
                    </li>
                  ) : (
                    <li
                      key={s.supplier}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border p-3"
                    >
                      <p className="min-w-0 truncate text-sm font-semibold">{s.supplier}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(s.supplier)}
                          aria-label="이름 수정"
                          className="rounded-full px-2 py-1.5 text-sm text-muted"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelect(s.supplier)}
                          className="rounded-full border border-brand bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand"
                        >
                          확인
                        </button>
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
