import { kstWeekday, shiftDateString } from "@/lib/date";

export type InventoryCountHistoryRow = {
  date: string;
  quantity: number;
  produced_quantity: number | null;
};

export type KitchenForecast = {
  kind: "kitchen";
  ready: boolean;
  sampleCount: number;
  suggestedQty: number | null;
};

export type HallForecast = {
  kind: "hall";
  ready: boolean;
  sampleCount: number;
  daysUntilStockout: number | null;
};

export type InventoryForecast = KitchenForecast | HallForecast;

const MIN_SAMPLES = 2;

// 주방: 전일재고 + 오늘생산 − 오늘재고 = 오늘 사용량. produced_quantity를
// 남긴 날만 정확한 사용량이라 그 날만 표본으로 쓴다(이 컬럼이 생기기 전
// 데이터는 produced_quantity가 null이라 자동으로 제외됨). 같은 요일 표본이
// 2개 이상 모이면 그 요일 평균 사용량에서 오늘 남은 재고를 뺀 만큼을
// 내일 생산 제안량으로 낸다.
export function kitchenSuggestedProduction(
  history: InventoryCountHistoryRow[],
  todayDate: string,
  todayQty: number
): KitchenForecast {
  const byDate = new Map(history.map((r) => [r.date, r]));
  const usagesByWeekday = new Map<number, number[]>();

  for (const row of history) {
    if (row.produced_quantity == null) continue;
    const prev = byDate.get(shiftDateString(row.date, -1));
    if (!prev) continue;
    const usage = prev.quantity + row.produced_quantity - row.quantity;
    if (usage < 0) continue;
    const weekday = kstWeekday(row.date);
    const list = usagesByWeekday.get(weekday) ?? [];
    list.push(usage);
    usagesByWeekday.set(weekday, list);
  }

  const targetWeekday = kstWeekday(shiftDateString(todayDate, 1));
  const samples = usagesByWeekday.get(targetWeekday) ?? [];
  if (samples.length < MIN_SAMPLES) {
    return { kind: "kitchen", ready: false, sampleCount: samples.length, suggestedQty: null };
  }

  const avg = samples.reduce((sum, v) => sum + v, 0) / samples.length;
  const suggestedQty = Math.max(0, Math.round(avg - todayQty));
  return { kind: "kitchen", ready: true, sampleCount: samples.length, suggestedQty };
}

// 홀: 전일재고 − 오늘재고 = 오늘 소모량. 재고가 늘어난 날(발주 도착일)은
// 소모가 아니라 평균에서 뺀다. 최근 소모량 평균으로 현재 재고가 며칠
// 후 바닥날지 어림잡는다.
export function hallDaysUntilStockout(
  history: InventoryCountHistoryRow[],
  todayQty: number
): HallForecast {
  const byDate = new Map(history.map((r) => [r.date, r]));
  const usages: number[] = [];

  for (const row of history) {
    const prev = byDate.get(shiftDateString(row.date, -1));
    if (!prev) continue;
    const usage = prev.quantity - row.quantity;
    if (usage <= 0) continue;
    usages.push(usage);
  }

  if (usages.length < MIN_SAMPLES) {
    return { kind: "hall", ready: false, sampleCount: usages.length, daysUntilStockout: null };
  }

  const avg = usages.reduce((sum, v) => sum + v, 0) / usages.length;
  const daysUntilStockout = avg > 0 ? Math.floor(todayQty / avg) : null;
  return { kind: "hall", ready: true, sampleCount: usages.length, daysUntilStockout };
}
