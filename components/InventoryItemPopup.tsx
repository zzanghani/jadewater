"use client";

import { useEffect, useState } from "react";
import InventoryItemForm from "@/components/InventoryItemForm";
import type { InventoryItem, InventorySection } from "@/lib/types";

export default function InventoryItemPopup({
  storeId,
  section,
  date,
  existing,
}: {
  storeId: string;
  section: InventorySection;
  date: string;
  existing?: InventoryItem;
}) {
  const [open, setOpen] = useState(Boolean(existing));

  // URL의 edit 파라미터가 사라지면(수정 완료/취소) 팝업도 같이 닫는다.
  useEffect(() => {
    setOpen(Boolean(existing));
  }, [existing]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
      >
        + 품목추가
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
              <h2 className="text-sm font-semibold text-foreground">
                {existing ? "품목 수정" : "품목 추가"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="text-muted"
              >
                ✕
              </button>
            </div>
            <InventoryItemForm
              key={existing?.id ?? "new"}
              storeId={storeId}
              section={section}
              date={date}
              existing={existing}
            />
          </div>
        </div>
      )}
    </>
  );
}
