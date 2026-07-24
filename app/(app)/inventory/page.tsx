import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { kstDateLabel, kstDateString } from "@/lib/date";
import InventoryItemPopup from "@/components/InventoryItemPopup";
import InventoryDatePicker from "@/components/InventoryDatePicker";
import InventoryCountForm from "@/components/InventoryCountForm";
import DeleteInventoryItemButton from "@/components/DeleteInventoryItemButton";
import type { InventorySection } from "@/lib/types";

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

  const [{ data: items }, { data: counts }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("*")
      .eq("store_id", storeId)
      .eq("section", section)
      .order("name", { ascending: true }),
    supabase
      .from("inventory_counts")
      .select("item_id, quantity")
      .eq("store_id", storeId)
      .eq("date", date),
  ]);

  const rows = items ?? [];
  const editing = edit ? rows.find((i) => i.id === edit) : undefined;
  const countByItemId = new Map((counts ?? []).map((c) => [c.item_id, c.quantity]));
  const dateLabel = kstDateLabel(date);

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
          />
        )}
      </section>

      {rows.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">품목 관리</h2>
          <ul className="flex flex-col gap-2">
            {rows.map((item) => (
              <li
                key={item.id}
                className={`flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 ${
                  item.id === editing?.id ? "border-brand" : "border-border"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.name}
                    {item.unit ? ` (${item.unit})` : ""}
                  </p>
                  {item.notes && <p className="truncate text-xs text-muted">{item.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    href={`/inventory?section=${encodeURIComponent(section)}&date=${date}&edit=${item.id}`}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-brand"
                  >
                    수정
                  </Link>
                  <DeleteInventoryItemButton id={item.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
