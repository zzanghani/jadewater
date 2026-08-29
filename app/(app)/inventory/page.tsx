import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { kstDateLabel, kstDateString, shiftDateString } from "@/lib/date";
import InventoryItemPopup from "@/components/InventoryItemPopup";
import InventoryManagePopup from "@/components/InventoryManagePopup";
import InventoryDatePicker from "@/components/InventoryDatePicker";
import InventoryCountForm from "@/components/InventoryCountForm";
import type { InventorySection } from "@/lib/types";
import {
  kitchenSuggestedProduction,
  hallDaysUntilStockout,
  type InventoryForecast,
} from "@/lib/inventoryForecast";

// 요일별 표본을 모으려는 용도라 8주치를 본다(최소 2회 표본 기준으로 넉넉하게).
const FORECAST_LOOKBACK_DAYS = 56;

const SECTIONS: InventorySection[] = ["홀", "주방"];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; edit?: string; date?: string }>;
}) {
  const { section: sectionParam, edit, date: dateParam } = await searchParams;
  const section: InventorySection = SECTIONS.includes(sectionParam as InventorySection)
    ? (sectionParam as InventorySection)
    : "홀";
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : kstDateString(0);

  const supabase = await createClient();
  const { storeId, storeName } = await getStoreContext(supabase);

  const previousDate = shiftDateString(date, -1);
  const forecastLookbackStart = shiftDateString(date, -FORECAST_LOOKBACK_DAYS);

  const [{ data: items }, { data: counts }, { data: previousCounts }, { data: history }] =
    await Promise.all([
      supabase
        .from("inventory_items")
        .select("*")
        .eq("store_id", storeId)
        .eq("section", section)
        .order("name", { ascending: true }),
      supabase
        .from("inventory_counts")
        .select("item_id, quantity, produced_quantity")
        .eq("store_id", storeId)
        .eq("date", date),
      supabase
        .from("inventory_counts")
        .select("item_id, quantity")
        .eq("store_id", storeId)
        .eq("date", previousDate),
      supabase
        .from("inventory_counts")
        .select("item_id, date, quantity, produced_quantity")
        .eq("store_id", storeId)
        .gte("date", forecastLookbackStart)
        .lte("date", date)
        .order("date", { ascending: true }),
    ]);

  const rows = items ?? [];
  const editing = edit ? rows.find((i) => i.id === edit) : undefined;
  const countByItemId = new Map((counts ?? []).map((c) => [c.item_id, c.quantity]));
  const producedByItemId = new Map(
    (counts ?? [])
      .filter((c) => c.produced_quantity != null)
      .map((c) => [c.item_id, c.produced_quantity as number])
  );
  const previousCountByItemId = new Map(
    (previousCounts ?? []).map((c) => [c.item_id, c.quantity])
  );
  const dateLabel = kstDateLabel(date);

  // 오늘 확정된 품목만 예측을 낸다 — 아직 오늘 재고를 안 찍었으면 기준점이 없어서 계산 불가.
  const historyByItemId = new Map<
    string,
    { date: string; quantity: number; produced_quantity: number | null }[]
  >();
  for (const row of history ?? []) {
    const list = historyByItemId.get(row.item_id) ?? [];
    list.push({ date: row.date, quantity: row.quantity, produced_quantity: row.produced_quantity });
    historyByItemId.set(row.item_id, list);
  }

  const forecastByItemId = new Map<string, InventoryForecast>();
  for (const item of rows) {
    const todayQty = countByItemId.get(item.id);
    if (todayQty === undefined) continue;
    const itemHistory = historyByItemId.get(item.id) ?? [];
    forecastByItemId.set(
      item.id,
      section === "주방"
        ? kitchenSuggestedProduction(itemHistory, date, todayQty)
        : hallDaysUntilStockout(itemHistory, todayQty)
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-3 text-lg font-bold">재고관리</h1>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-card p-1.5">
          {SECTIONS.map((s) => (
            <Link
              key={s}
              href={`/inventory?section=${encodeURIComponent(s)}&date=${date}`}
              className={`rounded-xl py-2.5 text-center text-sm font-semibold transition-colors ${
                section === s ? "bg-brand text-white shadow-sm" : "text-muted"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {section} 재고 · {dateLabel}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <InventoryItemPopup storeId={storeId} section={section} date={date} existing={editing} />
            <InventoryManagePopup
              section={section}
              date={date}
              items={rows}
              editingId={editing?.id}
            />
            <InventoryDatePicker section={section} date={date} />
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">먼저 품목을 등록해 주세요.</p>
        ) : (
          <InventoryCountForm
            storeId={storeId}
            storeName={storeName}
            section={section}
            date={date}
            dateLabel={dateLabel}
            items={rows}
            countByItemId={countByItemId}
            previousCountByItemId={previousCountByItemId}
            producedByItemId={producedByItemId}
            forecastByItemId={forecastByItemId}
          />
        )}
      </section>
    </div>
  );
}
