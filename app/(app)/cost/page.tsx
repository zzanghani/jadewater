import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { kstDateString, weekDatesKST } from "@/lib/date";
import { getStoreContext } from "@/lib/store";

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

function costPercent(cost: number, revenue: number): number | null {
  if (revenue <= 0) return null;
  return (cost / revenue) * 100;
}

function costColorClasses(pct: number | null): {
  text: string;
  bg: string;
  border: string;
} {
  if (pct === null) {
    return { text: "text-muted", bg: "bg-card", border: "border-border" };
  }
  if (pct <= 30) {
    return {
      text: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
    };
  }
  if (pct <= 35) {
    return {
      text: "text-yellow-600",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
    };
  }
  return { text: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
}

function CostCard({
  title,
  pct,
  costLabel,
  cost,
  revenueLabel,
  revenue,
}: {
  title: string;
  pct: number | null;
  costLabel: string;
  cost: number;
  revenueLabel: string;
  revenue: number;
}) {
  const c = costColorClasses(pct);
  return (
    <div className={`rounded-2xl border p-4 ${c.bg} ${c.border}`}>
      <p className="text-xs font-medium text-muted">{title}</p>
      <p className={`mt-1 text-3xl font-bold ${c.text}`}>
        {pct === null ? "-" : `${pct.toFixed(1)}%`}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-2 text-[11px] text-muted">
        <span>
          {costLabel} {formatWon(cost)}
        </span>
        <span>
          {revenueLabel} {formatWon(revenue)}
        </span>
      </div>
    </div>
  );
}

export default async function CostPage() {
  const supabase = await createClient();
  const { storeId } = await getStoreContext(supabase);
  const today = kstDateString(0);
  const thisWeek = weekDatesKST(0);

  const [{ data: todayReceipts }, { data: todayClosing }, { data: weekReceipts }, { data: weekClosings }] =
    await Promise.all([
      supabase
        .from("receipts")
        .select("amount, category")
        .eq("store_id", storeId)
        .eq("date", today),
      supabase
        .from("daily_closings")
        .select("food_sales, beverage_sales")
        .eq("store_id", storeId)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("receipts")
        .select("amount, category")
        .eq("store_id", storeId)
        .gte("date", thisWeek[0])
        .lte("date", thisWeek[6]),
      supabase
        .from("daily_closings")
        .select("food_sales, beverage_sales")
        .eq("store_id", storeId)
        .gte("date", thisWeek[0])
        .lte("date", thisWeek[6]),
    ]);

  const todayFoodCost = sum(
    (todayReceipts ?? [])
      .filter((r) => r.category === "식재료")
      .map((r) => r.amount)
  );
  const todayBeverageCost = sum(
    (todayReceipts ?? [])
      .filter((r) => r.category === "음료재료")
      .map((r) => r.amount)
  );
  const todayFoodSales = todayClosing?.food_sales ?? 0;
  const todayBeverageSales = todayClosing?.beverage_sales ?? 0;

  const weekFoodCost = sum(
    (weekReceipts ?? [])
      .filter((r) => r.category === "식재료")
      .map((r) => r.amount)
  );
  const weekBeverageCost = sum(
    (weekReceipts ?? [])
      .filter((r) => r.category === "음료재료")
      .map((r) => r.amount)
  );
  const weekFoodSales = sum((weekClosings ?? []).map((s) => s.food_sales));
  const weekBeverageSales = sum(
    (weekClosings ?? []).map((s) => s.beverage_sales)
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold">실시간 코스트</h1>
        <p className="mt-1 text-xs text-muted">
          30% 이하 초록 · 30~35% 노랑 · 35% 초과 빨강
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">푸드코스트</h2>
        <div className="grid grid-cols-2 gap-3">
          <CostCard
            title="오늘"
            pct={costPercent(todayFoodCost, todayFoodSales)}
            costLabel="입고"
            cost={todayFoodCost}
            revenueLabel="매출"
            revenue={todayFoodSales}
          />
          <CostCard
            title="이번주 평균"
            pct={costPercent(weekFoodCost, weekFoodSales)}
            costLabel="입고"
            cost={weekFoodCost}
            revenueLabel="매출"
            revenue={weekFoodSales}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">음료코스트</h2>
        <div className="grid grid-cols-2 gap-3">
          <CostCard
            title="오늘"
            pct={costPercent(todayBeverageCost, todayBeverageSales)}
            costLabel="입고"
            cost={todayBeverageCost}
            revenueLabel="매출"
            revenue={todayBeverageSales}
          />
          <CostCard
            title="이번주 평균"
            pct={costPercent(weekBeverageCost, weekBeverageSales)}
            costLabel="입고"
            cost={weekBeverageCost}
            revenueLabel="매출"
            revenue={weekBeverageSales}
          />
        </div>
      </section>
    </div>
  );
}
