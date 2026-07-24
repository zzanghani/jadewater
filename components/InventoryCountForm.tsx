"use client";

import { forwardRef, useActionState, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { saveDailyCounts } from "@/app/(app)/inventory/actions";
import type { InventoryItem, InventorySection } from "@/lib/types";

export default function InventoryCountForm({
  storeId,
  storeName,
  section,
  date,
  dateLabel,
  items,
  countByItemId,
}: {
  storeId: string;
  storeName: string;
  section: InventorySection;
  date: string;
  dateLabel: string;
  items: InventoryItem[];
  countByItemId: Map<string, number>;
}) {
  const [state, formAction, pending] = useActionState(saveDailyCounts, undefined);
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, String(countByItemId.get(item.id) ?? "")])
    )
  );

  const reportRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  async function handleSaveImage() {
    if (!reportRef.current) return;
    setCapturing(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `${storeName}_${dateLabel}_${section}_재고.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
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
                value={quantities[item.id] ?? ""}
                onChange={(e) =>
                  setQuantities((q) => ({ ...q, [item.id]: e.target.value }))
                }
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

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">재고 리포트</h2>
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={capturing}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {capturing ? "생성 중..." : "이미지로 저장"}
          </button>
        </div>

        <InventoryReport
          ref={reportRef}
          storeName={storeName}
          section={section}
          dateLabel={dateLabel}
          items={items.map((item) => ({
            name: item.name,
            unit: item.unit,
            quantity: Number(quantities[item.id]) || 0,
          }))}
        />
      </section>
    </div>
  );
}

const InventoryReport = forwardRef<
  HTMLDivElement,
  {
    storeName: string;
    section: InventorySection;
    dateLabel: string;
    items: { name: string; unit: string | null; quantity: number }[];
  }
>(function InventoryReport({ storeName, section, dateLabel, items }, ref) {
  return (
    <div
      ref={ref}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-5 text-[#1c2624]"
    >
      <div className="border-b border-border pb-3">
        <p className="text-lg font-bold">{storeName}</p>
        <p className="text-sm text-muted">
          {dateLabel} · {section} 재고
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted">등록된 품목이 없습니다.</p>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between border-b border-border/60 py-2 text-sm last:border-b-0"
            >
              <span>
                {item.name}
                {item.unit ? ` (${item.unit})` : ""}
              </span>
              <span className="font-semibold">{item.quantity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
