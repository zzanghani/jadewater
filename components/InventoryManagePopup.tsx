"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DeleteInventoryItemButton from "@/components/DeleteInventoryItemButton";
import type { InventoryItem, InventorySection } from "@/lib/types";

export default function InventoryManagePopup({
  section,
  date,
  items,
  editingId,
}: {
  section: InventorySection;
  date: string;
  items: InventoryItem[];
  editingId?: string;
}) {
  const [open, setOpen] = useState(false);

  // "수정"으로 이동하면(edit 파라미터가 생기면) 이 팝업은 닫고
  // 품목 추가/수정 팝업 쪽이 열리도록 넘겨준다.
  useEffect(() => {
    if (editingId) setOpen(false);
  }, [editingId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
      >
        품목관리
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">품목 관리</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="text-muted"
              >
                ✕
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted">등록된 품목이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.name}
                        {item.unit ? ` (${item.unit})` : ""}
                      </p>
                      {item.notes && (
                        <p className="truncate text-xs text-muted">{item.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        href={`/inventory?section=${encodeURIComponent(section)}&date=${date}&edit=${item.id}`}
                        onClick={() => setOpen(false)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-brand"
                      >
                        수정
                      </Link>
                      <DeleteInventoryItemButton id={item.id} />
                    </div>
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
