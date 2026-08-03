import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { kstDateString, kstShortDateLabel, kstWeekdayShortLabel, last7DaysKST } from "@/lib/date";
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

function DailyCostList({
  title,
  rows,
}: {
  title: string;
  rows: { date: string; pct: number | null }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 text-xs font-medium text-muted">{title}</p>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((r) => {
          const c = costColorClasses(r.pct);
          const isToday = r.date === kstDateString(0);
          return (
            <li
              key={r.date}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className={isToday ? "font-semibold text-foreground" : "text-muted"}>
                {kstShortDateLabel(r.date)}({kstWeekdayShortLabel(r.date)}){isToday ? " · 오늘" : ""}
              </span>
              <span className={`font-bold ${c.text}`}>
                {r.pct === null ? "-" : `${r.pct.toFixed(1)}%`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function CostPage() {
  const supabase = await createClient();
  const { storeId } = await getStoreContext(supabase);
  const today = kstDateString(0);
  const days = last7DaysKST();

  const [{ data: todayReceipts }, { data: todayClosing }, { data: rangeReceipts }, { data: rangeClosings }] =
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
        .select("date, amount, category")
        .eq("store_id", storeId)
        .gte("date", days[0])
        .lte("date", days[6]),
      supabase
        .from("daily_closings")
        .select("date, food_sales, beverage_sales")
        .eq("store_id", storeId)
        .gte("date", days[0])
        .lte("date", days[6]),
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

  // 일자별로 그날의 입고·매출만 따로 모아서, 주 단위로 뭉뚱그리지 않고
  // 하루하루의 코스트율을 그대로 보여준다.
  const foodCostByDate = new Map<string, number>();
  const beverageCostByDate = new Map<string, number>();
  for (const r of rangeReceipts ?? []) {
    if (r.category === "식재료") {
      foodCostByDate.set(r.date, (foodCostByDate.get(r.date) ?? 0) + r.amount);
    } else if (r.category === "음료재료") {
      beverageCostByDate.set(r.date, (beverageCostByDate.get(r.date) ?? 0) + r.amount);
    }
  }
  const foodSalesByDate = new Map<string, number>();
  const beverageSalesByDate = new Map<string, number>();
  for (const c of rangeClosings ?? []) {
    foodSalesByDate.set(c.date, c.food_sales);
    beverageSalesByDate.set(c.date, c.beverage_sales);
  }

  const foodDailyRows = days.map((date) => ({
    date,
    pct: costPercent(foodCostByDate.get(date) ?? 0, foodSalesByDate.get(date) ?? 0),
  }));
  const beverageDailyRows = days.map((date) => ({
    date,
    pct: costPercent(beverageCostByDate.get(date) ?? 0, beverageSalesByDate.get(date) ?? 0),
  }));

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
        <CostCard
          title="실시간누적"
          pct={costPercent(todayFoodCost, todayFoodSales)}
          costLabel="입고"
          cost={todayFoodCost}
          revenueLabel="매출"
          revenue={todayFoodSales}
        />
        <DailyCostList title="최근 7일" rows={foodDailyRows} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">음료코스트</h2>
        <CostCard
          title="실시간누적"
          pct={costPercent(todayBeverageCost, todayBeverageSales)}
          costLabel="입고"
          cost={todayBeverageCost}
          revenueLabel="매출"
          revenue={todayBeverageSales}
        />
        <DailyCostList title="최근 7일" rows={beverageDailyRows} />
      </section>
    </div>
  );
}
