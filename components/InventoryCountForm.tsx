"use client";

import { useActionState } from "react";
import { saveDailyCounts } from "@/app/(app)/inventory/actions";
import type { InventoryItem } from "@/lib/types";

export default function InventoryCountForm({
  storeId,
  date,
  items,
  countByItemId,
}: {
  storeId: string;
  date: string;
  items: InventoryItem[];
  countByItemId: Map<string, number>;
}) {
  const [state, formAction, pending] = useActionState(saveDailyCounts, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="store_id" value={storeId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="item_ids" value={items.map((i) => i.id).join(",")} />

      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5"
          >
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {item.name}
              {item.unit ? ` (${item.unit})` : ""}
            </span>
            <input
              type="number"
              name={`qty_${item.id}`}
              step="any"
              min="0"
              defaultValue={countByItemId.get(item.id) ?? ""}
              placeholder="0"
              className="w-20 shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-right text-sm outline-none ring-brand/30 focus:ring-2"
            />
          </div>
        ))}
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state?.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">저장되었습니다.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
      >
        {pending ? "저장 중..." : "재고 저장"}
      </button>
    </form>
  );
}
