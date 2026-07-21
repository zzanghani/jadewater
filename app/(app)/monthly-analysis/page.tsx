import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { daysInMonthKST, monthRangeKST } from "@/lib/date";
import MonthlySalesChart, {
  type MonthlyPoint,
} from "@/components/MonthlySalesChart";
import MultiStoreChart, { type MultiStorePoint, type StoreSeries } from "@/components/MultiStoreChart";
import PeriodSummaryToggle from "@/components/PeriodSummaryToggle";
import { getStoreContext } from "@/lib/store";
import { storeColor } from "@/lib/storeColors";
import { computePeriodBreakdown } from "@/lib/periodBreakdown";
import type { DailyClosing } from "@/lib/types";

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

function DeltaText({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return (
      <span className="text-[11px] text-white/70">
        {current > 0 ? "신규" : "-"}
      </span>
    );
  }
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <span className="text-[11px] font-semibold text-white">
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return (
      <span className="text-xs font-medium text-muted">
        {current > 0 ? "지난달 데이터 없음" : "-"}
      </span>
    );
  }
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <span
      className={`text-xs font-semibold ${up ? "text-brand" : "text-red-500"}`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function SalesCompareCard({
  title,
  current,
  previous,
}: {
  title: string;
  current: number;
  previous: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-xs text-muted">{title}</p>
      <p className="mt-1 text-base font-bold">{formatWon(current)}</p>
      <div className="mt-1.5 flex flex-col gap-1">
        <span className="text-[11px] text-muted">
          지난달 {formatWon(previous)}
        </span>
        <DeltaBadge current={current} previous={previous} />
      </div>
    </div>
  );
}

export default async function MonthlyAnalysisPage() {
  const supabase = await createClient();
  const { storeId, stores } = await getStoreContext(supabase);
  const isMaster = stores.length > 1;
  const thisMonth = monthRangeKST(0);
  const lastMonth = monthRangeKST(1);

  if (isMaster) {
    const [{ data: rangeRows }, breakdown] = await Promise.all([
      supabase
        .from("daily_closings")
        .select("date, store_id, grand_total")
        .gte("date", lastMonth.start)
        .lte("date", thisMonth.end),
      computePeriodBreakdown(supabase),
    ]);

    const byDateStore = new Map<string, Map<string, number>>();
    for (const r of rangeRows ?? []) {
      const dayMap = byDateStore.get(r.date) ?? new Map<string, number>();
      dayMap.set(r.store_id, (dayMap.get(r.store_id) ?? 0) + r.grand_total);
      byDateStore.set(r.date, dayMap);
    }

    const thisMonthDays = daysInMonthKST(thisMonth.start);
    const lastMonthDays = daysInMonthKST(lastMonth.start);

    const storeCards = stores.map((s) => ({
      id: s.id,
      name: s.name,
      color: storeColor(s.name),
      current: sum(thisMonthDays.map((d) => byDateStore.get(d)?.get(s.id) ?? 0)),
      previous: sum(lastMonthDays.map((d) => byDateStore.get(d)?.get(s.id) ?? 0)),
    }));

    const multiChartData: MultiStorePoint[] = thisMonthDays.map((d) => {
      const point: MultiStorePoint = { label: String(Number(d.slice(-2))) };
      for (const s of stores) {
        point[s.id] = byDateStore.get(d)?.get(s.id) ?? 0;
      }
      return point;
    });
    const series: StoreSeries[] = stores.map((s) => ({
      key: s.id,
      name: s.name,
      color: storeColor(s.name),
    }));

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-bold">월간 분석</h1>
          <p className="mt-1 text-xs text-muted">{thisMonth.label}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {storeCards.map((s) => (
            <div
              key={s.id}
              style={{ backgroundColor: s.color }}
              className="rounded-2xl p-4 text-white shadow-lg"
            >
              <p className="text-xs leading-tight text-white/85">{s.name}</p>
              <p className="mt-1 text-lg font-bold">{formatWon(s.current)}</p>
              <div className="mt-2 flex items-center justify-between border-t border-white/25 pt-2 text-[11px] text-white/90">
                <span>지난달 {formatWon(s.previous)}</span>
                <DeltaText current={s.current} previous={s.previous} />
              </div>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            일별 매장별 매출
          </h2>
          <MultiStoreChart data={multiChartData} series={series} />
        </section>

        <PeriodSummaryToggle
          weekly={breakdown.weekly}
          monthly={breakdown.monthly}
          series={series}
        />
      </div>
    );
  }

  const { data: closingRows } = await supabase
    .from("daily_closings")
    .select("date, food_sales, beverage_sales, wine_sales, grand_total")
    .eq("store_id", storeId)
    .gte("date", lastMonth.start)
    .lte("date", thisMonth.end)
    .order("date", { ascending: true });

  const byDate = new Map<
    string,
    Pick<
      DailyClosing,
      "food_sales" | "beverage_sales" | "wine_sales" | "grand_total"
    >
  >((closingRows ?? []).map((c) => [c.date, c]));

  const thisMonthDays = daysInMonthKST(thisMonth.start);
  const lastMonthDays = daysInMonthKST(lastMonth.start);

  const thisMonthSales = sum(
    thisMonthDays.map((d) => byDate.get(d)?.grand_total ?? 0)
  );
  const lastMonthSales = sum(
    lastMonthDays.map((d) => byDate.get(d)?.grand_total ?? 0)
  );
  const thisMonthFood = sum(
    thisMonthDays.map((d) => byDate.get(d)?.food_sales ?? 0)
  );
  const lastMonthFood = sum(
    lastMonthDays.map((d) => byDate.get(d)?.food_sales ?? 0)
  );
  const thisMonthBeverage = sum(
    thisMonthDays.map((d) => byDate.get(d)?.beverage_sales ?? 0)
  );
  const lastMonthBeverage = sum(
    lastMonthDays.map((d) => byDate.get(d)?.beverage_sales ?? 0)
  );
  const thisMonthWine = sum(
    thisMonthDays.map((d) => byDate.get(d)?.wine_sales ?? 0)
  );
  const lastMonthWine = sum(
    lastMonthDays.map((d) => byDate.get(d)?.wine_sales ?? 0)
  );

  const { data: receiptRows } = await supabase
    .from("receipts")
    .select("amount")
    .eq("store_id", storeId)
    .gte("date", thisMonth.start)
    .lte("date", thisMonth.end);

  const monthlyReceiptTotal = sum((receiptRows ?? []).map((r) => r.amount));

  const chartData: MonthlyPoint[] = thisMonthDays.map((d) => ({
    label: String(Number(d.slice(-2))),
    food: byDate.get(d)?.food_sales ?? 0,
    beverage: byDate.get(d)?.beverage_sales ?? 0,
    wine: byDate.get(d)?.wine_sales ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold">월간 분석</h1>
        <p className="mt-1 text-xs text-muted">{thisMonth.label}</p>
      </div>

      <section className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-4 text-white shadow-lg shadow-brand/25">
        <p className="text-sm text-white/85">이번달 총매출</p>
        <p className="mt-1 text-2xl font-bold">{formatWon(thisMonthSales)}</p>
        <div className="mt-2 flex items-center justify-between border-t border-white/20 pt-2 text-sm">
          <span className="text-white/85">지난달 {formatWon(lastMonthSales)}</span>
          <DeltaBadge current={thisMonthSales} previous={lastMonthSales} />
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <SalesCompareCard
          title="음식매출"
          current={thisMonthFood}
          previous={lastMonthFood}
        />
        <SalesCompareCard
          title="음료매출"
          current={thisMonthBeverage}
          previous={lastMonthBeverage}
        />
        <SalesCompareCard
          title="와인매출"
          current={thisMonthWine}
          previous={lastMonthWine}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          일별 매출
        </h2>
        <MonthlySalesChart data={chartData} />
      </section>

      <section className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
        <span className="text-sm font-medium text-foreground">이번달 총 입고금액</span>
        <span className="text-lg font-bold text-brand">
          {formatWon(monthlyReceiptTotal)}
        </span>
      </section>
    </div>
  );
}
