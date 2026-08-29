"use client";

import { forwardRef, useActionState, useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { saveDailyCounts } from "@/app/(app)/inventory/actions";
import type { InventoryItem, InventorySection } from "@/lib/types";
import type { InventoryForecast } from "@/lib/inventoryForecast";

export default function InventoryCountForm({
  storeId,
  storeName,
  section,
  date,
  dateLabel,
  items,
  countByItemId,
  previousCountByItemId,
  producedByItemId,
  forecastByItemId,
}: {
  storeId: string;
  storeName: string;
  section: InventorySection;
  date: string;
  dateLabel: string;
  items: InventoryItem[];
  countByItemId: Map<string, number>;
  previousCountByItemId: Map<string, number>;
  producedByItemId?: Map<string, number>;
  forecastByItemId?: Map<string, InventoryForecast>;
}) {
  const isEditingExisting = countByItemId.size > 0;
  const isKitchen = section === "주방";
  const [state, formAction, pending] = useActionState(saveDailyCounts, undefined);
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, String(countByItemId.get(item.id) ?? "")])
    )
  );
  const [productions, setProductions] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, String(producedByItemId?.get(item.id) ?? "")])
    )
  );

  // 저장 성공하면 입력칸을 비워서(0으로) 바로 다음 카운트를 새로 입력할
  // 수 있게 한다 — "확정" 배지가 방금 저장한 값을 계속 보여주므로
  // 입력칸까지 값을 남겨둘 필요가 없다.
  useEffect(() => {
    if (!state?.success) return;
    setQuantities(Object.fromEntries(items.map((item) => [item.id, ""])));
    setProductions(Object.fromEntries(items.map((item) => [item.id, ""])));
  }, [state, items]);

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
        <input type="hidden" name="section" value={section} />
        <input type="hidden" name="item_ids" value={items.map((i) => i.id).join(",")} />

        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const forecast = forecastByItemId?.get(item.id);
            const forecastLabel =
              forecast?.kind === "kitchen"
                ? forecast.ready
                  ? `내일 생산 제안: ${forecast.suggestedQty}${item.unit ?? ""}`
                  : `생산량 데이터 수집 중 (${forecast.sampleCount}/2)`
                : forecast?.kind === "hall"
                  ? forecast.ready
                    ? forecast.daysUntilStockout !== null
                      ? `이 추세면 약 ${forecast.daysUntilStockout}일 후 소진`
                      : null
                    : `소진 예측 데이터 수집 중 (${forecast.sampleCount}/2)`
                  : null;
            const forecastUrgent =
              forecast?.kind === "hall" &&
              forecast.ready &&
              forecast.daysUntilStockout !== null &&
              forecast.daysUntilStockout <= 3;

            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="truncate text-sm font-semibold text-foreground">
                  {item.name}
                  {item.unit ? ` (${item.unit})` : ""}
                </span>
                {isKitchen && (
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs font-semibold text-muted">생산량</span>
                    <input
                      type="number"
                      name={`produced_${item.id}`}
                      step="any"
                      min="0"
                      value={productions[item.id] ?? ""}
                      onChange={(e) =>
                        setProductions((p) => ({ ...p, [item.id]: e.target.value }))
                      }
                      placeholder="0"
                      className="w-24 shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-center text-sm font-semibold outline-none ring-brand/30 focus:ring-2"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 flex-col items-center gap-0.5 rounded-lg bg-background px-2 py-1.5">
                    <span className="text-[9px] font-semibold text-muted">전일재고</span>
                    <span className="text-sm font-bold text-foreground">
                      {previousCountByItemId.get(item.id) ?? "-"}
                    </span>
                  </div>
                  <div className="flex w-24 shrink-0 flex-col items-center gap-0.5">
                    <span className="text-[9px] font-semibold text-muted">마감재고</span>
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
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-center text-base font-semibold outline-none ring-brand/30 focus:ring-2"
                    />
                  </div>
                  <div
                    className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 ${
                      countByItemId.has(item.id) ? "bg-brand-light" : "bg-background"
                    }`}
                  >
                    <span
                      className={`text-[9px] font-semibold ${
                        countByItemId.has(item.id) ? "text-brand-dark" : "text-muted"
                      }`}
                    >
                      확정재고
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        countByItemId.has(item.id) ? "text-brand-dark" : "text-muted"
                      }`}
                    >
                      {countByItemId.get(item.id) ?? "-"}
                    </span>
                  </div>
                </div>
                {forecastLabel && (
                  <p
                    className={`text-xs font-medium ${
                      forecastUrgent ? "text-red-600" : "text-muted"
                    }`}
                  >
                    {forecastLabel}
                  </p>
                )}
              </div>
            );
          })}
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
          {pending ? "저장 중..." : isEditingExisting ? "재고 수정" : "재고 저장"}
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
