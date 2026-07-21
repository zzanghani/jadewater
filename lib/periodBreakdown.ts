import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { daysInMonthKST, monthRangeKST } from "./date";

export type PeriodRow = {
  label: string;
  total: number;
  byStore: Record<string, number>;
};

function sumValues(byStore: Record<string, number>): number {
  return Object.values(byStore).reduce((a, b) => a + b, 0);
}

// 최근 6개월(이번달 포함) 매장별 매출을 조회해 주단위(이번달 7일 단위)/월단위 집계로 반환한다.
export async function computePeriodBreakdown(
  supabase: SupabaseClient<Database>
): Promise<{ weekly: PeriodRow[]; monthly: PeriodRow[] }> {
  const thisMonth = monthRangeKST(0);
  const monthsBack = 5;
  const rangeStart = monthRangeKST(monthsBack).start;

  const { data: rows } = await supabase
    .from("daily_closings")
    .select("date, store_id, grand_total")
    .gte("date", rangeStart)
    .lte("date", thisMonth.end);

  const monthlyMap = new Map<string, Record<string, number>>();
  const weeklyMap = new Map<number, Record<string, number>>();

  for (const r of rows ?? []) {
    const monthKey = r.date.slice(0, 7);
    const monthBucket = monthlyMap.get(monthKey) ?? {};
    monthBucket[r.store_id] = (monthBucket[r.store_id] ?? 0) + r.grand_total;
    monthlyMap.set(monthKey, monthBucket);

    if (r.date >= thisMonth.start && r.date <= thisMonth.end) {
      const dayOfMonth = Number(r.date.slice(8, 10));
      const weekIndex = Math.floor((dayOfMonth - 1) / 7);
      const weekBucket = weeklyMap.get(weekIndex) ?? {};
      weekBucket[r.store_id] = (weekBucket[r.store_id] ?? 0) + r.grand_total;
      weeklyMap.set(weekIndex, weekBucket);
    }
  }

  const monthly: PeriodRow[] = [];
  for (let i = monthsBack; i >= 0; i--) {
    const m = monthRangeKST(i);
    const key = m.start.slice(0, 7);
    const byStore = monthlyMap.get(key) ?? {};
    monthly.push({ label: m.label, total: sumValues(byStore), byStore });
  }

  const totalDaysInMonth = daysInMonthKST(thisMonth.start).length;
  const weekCount = Math.ceil(totalDaysInMonth / 7);
  const weekly: PeriodRow[] = [];
  for (let i = 0; i < weekCount; i++) {
    const startDay = i * 7 + 1;
    const endDay = Math.min(startDay + 6, totalDaysInMonth);
    const byStore = weeklyMap.get(i) ?? {};
    weekly.push({
      label: `${startDay}~${endDay}일`,
      total: sumValues(byStore),
      byStore,
    });
  }

  return { weekly, monthly };
}
