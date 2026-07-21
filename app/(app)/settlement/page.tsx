import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { kstDateString } from "@/lib/date";
import { getStoreContext } from "@/lib/store";
import SettlementForm from "@/components/SettlementForm";
import SettlementPasswordGate from "@/components/SettlementPasswordGate";

function monthInfo(monthParam?: string) {
  const base =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : kstDateString(0).slice(0, 7);
  const [y, m] = base.split("-").map(Number);
  const start = `${base}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${base}-${String(lastDay).padStart(2, "0")}`;
  const label = `${y}년 ${m}월`;

  const prevTotal = y * 12 + (m - 1) - 1;
  const nextTotal = y * 12 + (m - 1) + 1;
  const prev = `${Math.floor(prevTotal / 12)}-${String((prevTotal % 12) + 1).padStart(2, "0")}`;
  const next = `${Math.floor(nextTotal / 12)}-${String((nextTotal % 12) + 1).padStart(2, "0")}`;

  return { month: base, start, end, label, prev, next };
}

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

export default async function SettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const { start, end, label, prev, next } = monthInfo(monthParam);

  const supabase = await createClient();
  const { storeId, storeName, stores } = await getStoreContext(supabase);

  // store_id가 NULL(마스터 계정)이면 stores에 전 지점이 담겨 2개 이상 보인다.
  // 지점 계정(store_id 있음)은 자기 매장 1개만 보이므로, 그 경우에만 비밀번호를 요구한다.
  const isMaster = stores.length > 1;

  const { data: closingRows } = await supabase
    .from("daily_closings")
    .select(
      "food_sales, beverage_sales, wine_sales, rental_sales, coupang_eats_sales, baemin_sales, grand_total, discount_amount"
    )
    .eq("store_id", storeId)
    .gte("date", start)
    .lte("date", end);

  const { data: receiptRows } = await supabase
    .from("receipts")
    .select("amount, supplier")
    .eq("store_id", storeId)
    .gte("date", start)
    .lte("date", end);

  const { data: existing } = await supabase
    .from("monthly_settlements")
    .select("*")
    .eq("store_id", storeId)
    .eq("month", start)
    .maybeSingle();

  const autoSales = {
    totalSales: sum((closingRows ?? []).map((c) => c.grand_total)),
    foodSales: sum((closingRows ?? []).map((c) => c.food_sales)),
    beverageSales: sum((closingRows ?? []).map((c) => c.beverage_sales)),
    wineSales: sum((closingRows ?? []).map((c) => c.wine_sales)),
    rentalSales: sum((closingRows ?? []).map((c) => c.rental_sales)),
    coupangSales: sum((closingRows ?? []).map((c) => c.coupang_eats_sales)),
    baeminSales: sum((closingRows ?? []).map((c) => c.baemin_sales)),
  };

  const autoDiscountTotal = sum((closingRows ?? []).map((c) => c.discount_amount));

  const supplierTotals = new Map<string, number>();
  for (const r of receiptRows ?? []) {
    supplierTotals.set(r.supplier, (supplierTotals.get(r.supplier) ?? 0) + r.amount);
  }
  const supplierList = Array.from(supplierTotals.entries())
    .map(([supplier, amount]) => ({ supplier, amount }))
    .sort((a, b) => b.amount - a.amount);
  const purchaseTotal = sum(supplierList.map((s) => s.amount));

  const content = (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">월말정산</h1>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Link
            href={`/settlement?month=${prev}`}
            className="rounded-full border border-border px-2.5 py-1 text-muted"
          >
            ‹
          </Link>
          <span>{label}</span>
          <Link
            href={`/settlement?month=${next}`}
            className="rounded-full border border-border px-2.5 py-1 text-muted"
          >
            ›
          </Link>
        </div>
      </div>

      <SettlementForm
        storeId={storeId}
        storeName={storeName}
        month={start}
        monthLabel={label}
        autoSales={autoSales}
        supplierList={supplierList}
        purchaseTotal={purchaseTotal}
        autoDiscountTotal={autoDiscountTotal}
        existing={existing ?? undefined}
      />
    </div>
  );

  if (isMaster) {
    return content;
  }

  return <SettlementPasswordGate>{content}</SettlementPasswordGate>;
}
