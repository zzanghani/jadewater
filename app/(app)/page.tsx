import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import {
  kstDateLabel,
  kstDateString,
  kstShortDateLabel,
  last7DaysKST,
  monthRangeKST,
} from "@/lib/date";
import DashboardChart, { type ChartPoint } from "@/components/DashboardChart";
import MultiStoreChart, { type MultiStorePoint, type StoreSeries } from "@/components/MultiStoreChart";
import QuickMenu from "@/components/QuickMenu";
import { getStoreContext } from "@/lib/store";
import { storeColor } from "@/lib/storeColors";
import type { DailyClosing } from "@/lib/types";

function sumByStore(rows: { store_id: string; grand_total: number }[] | null) {
  const map = new Map<string, number>();
  for (const r of rows ?? []) {
    map.set(r.store_id, (map.get(r.store_id) ?? 0) + r.grand_total);
  }
  return map;
}

function momLabel(current: number, prev: number): string {
  if (prev === 0) return current === 0 ? "-" : "신규";
  const pct = ((current - prev) / prev) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { storeId, stores } = await getStoreContext(supabase);
  const isMaster = stores.length > 1;
  const days = last7DaysKST();
  const today = kstDateString(0);
  const todayLabel = kstShortDateLabel(today);

  const { data: closings } = await supabase
    .from("daily_closings")
    .select("*")
    .eq("store_id", storeId)
    .gte("date", days[0])
    .lte("date", today)
    .order("date", { ascending: true });

  const byDate = new Map<string, DailyClosing>(
    (closings ?? []).map((c) => [c.date, c])
  );

  const todayClosing = byDate.get(today);
  const todaySales = todayClosing?.grand_total ?? 0;
  const todayGuests = todayClosing?.total_guests ?? 0;

  const chartData: ChartPoint[] = days.map((date) => ({
    label: kstDateLabel(date),
    sales: byDate.get(date)?.grand_total ?? 0,
  }));

  let storeTodaySales: { id: string; name: string; sales: number }[] = [];
  let multiChartData: MultiStorePoint[] = [];
  let multiChartSeries: StoreSeries[] = [];
  let storeMonthCompare: {
    id: string;
    name: string;
    color: string;
    thisMonth: number;
    lastMonth: number;
    mom: string;
  }[] = [];

  if (isMaster) {
    const thisMonth = monthRangeKST(0);
    const lastMonth = monthRangeKST(1);
    const dayOfMonth = Number(today.slice(8, 10));
    const lastMonthLastDay = Number(lastMonth.end.slice(8, 10));
    const lastMonthMtdEnd = `${lastMonth.start.slice(0, 7)}-${String(
      Math.min(dayOfMonth, lastMonthLastDay)
    ).padStart(2, "0")}`;

    const [
      { data: todayRows },
      { data: last7Rows },
      { data: thisMonthRows },
      { data: lastMonthRows },
    ] = await Promise.all([
      supabase.from("daily_closings").select("store_id, grand_total").eq("date", today),
      supabase
        .from("daily_closings")
        .select("date, store_id, grand_total")
        .gte("date", days[0])
        .lte("date", today),
      supabase
        .from("daily_closings")
        .select("store_id, grand_total")
        .gte("date", thisMonth.start)
        .lte("date", today),
      supabase
        .from("daily_closings")
        .select("store_id, grand_total")
        .gte("date", lastMonth.start)
        .lte("date", lastMonthMtdEnd),
    ]);

    const todayMap = sumByStore(todayRows);
    const thisMonthMap = sumByStore(thisMonthRows);
    const lastMonthMap = sumByStore(lastMonthRows);

    storeTodaySales = stores.map((s) => ({
      id: s.id,
      name: s.name,
      sales: todayMap.get(s.id) ?? 0,
    }));

    const dailyByStore = new Map<string, Map<string, number>>();
    for (const r of last7Rows ?? []) {
      const dayMap = dailyByStore.get(r.date) ?? new Map<string, number>();
      dayMap.set(r.store_id, (dayMap.get(r.store_id) ?? 0) + r.grand_total);
      dailyByStore.set(r.date, dayMap);
    }
    multiChartData = days.map((date) => {
      const point: MultiStorePoint = { label: kstDateLabel(date) };
      for (const s of stores) {
        point[s.id] = dailyByStore.get(date)?.get(s.id) ?? 0;
      }
      return point;
    });
    multiChartSeries = stores.map((s) => ({
      key: s.id,
      name: s.name,
      color: storeColor(s.name),
    }));

    storeMonthCompare = stores.map((s) => {
      const thisMonthSales = thisMonthMap.get(s.id) ?? 0;
      const lastMonthSales = lastMonthMap.get(s.id) ?? 0;
      return {
        id: s.id,
        name: s.name,
        color: storeColor(s.name),
        thisMonth: thisMonthSales,
        lastMonth: lastMonthSales,
        mom: momLabel(thisMonthSales, lastMonthSales),
      };
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {isMaster ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">실시간매출</h2>
            <span className="text-2xl font-bold text-foreground">{todayLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {storeTodaySales.map((s) => (
              <Link
                key={s.id}
                href={`/store/${s.id}`}
                style={{ backgroundColor: storeColor(s.name) }}
                className="rounded-2xl p-4 text-white shadow-lg transition-opacity active:opacity-80"
              >
                <p className="text-xs leading-tight text-white/85">{s.name}</p>
                <p className="mt-1 text-lg font-bold">{formatWon(s.sales)}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <Link
          href={`/store/${storeId}`}
          className="block rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-5 text-white shadow-lg shadow-brand/25 transition-opacity active:opacity-90"
        >
          <div className="flex items-center justify-between text-sm text-white/80">
            <span>오늘 매출</span>
            <span>{todayLabel}</span>
          </div>
          <p className="mt-1 text-3xl font-bold">{formatWon(todaySales)}</p>
          <div className="mt-4 flex items-center justify-between border-t border-white/20 pt-3">
            <span className="text-sm text-white/80">오늘 총객수</span>
            <span className="text-lg font-semibold">
              {todayGuests.toLocaleString()}명
            </span>
          </div>
        </Link>
      )}

      <QuickMenu isMaster={isMaster} />

      {!isMaster && !todayClosing && (
        <Link
          href="/closing"
          className="flex items-center justify-between rounded-2xl border border-brand-light bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark"
        >
          아직 오늘 마감을 입력하지 않았어요
          <span aria-hidden>→</span>
        </Link>
      )}

      {isMaster ? (
        <>
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              최근 7일 매출
            </h2>
            <MultiStoreChart data={multiChartData} series={multiChartSeries} />
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              전월 대비 이번달 매출
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-medium">매장</th>
                  <th className="pb-2 text-right font-medium">이번달</th>
                  <th className="pb-2 text-right font-medium">전달</th>
                  <th className="pb-2 text-right font-medium">증감률</th>
                </tr>
              </thead>
              <tbody>
                {storeMonthCompare.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </span>
                    </td>
                    <td className="py-2 text-right font-semibold text-foreground">
                      {formatWon(s.thisMonth)}
                    </td>
                    <td className="py-2 text-right text-muted">
                      {formatWon(s.lastMonth)}
                    </td>
                    <td className="py-2 text-right font-semibold">{s.mom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            최근 7일 매출
          </h2>
          <DashboardChart data={chartData} />
        </section>
      )}
    </div>
  );
}
