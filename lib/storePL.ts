// 매장 월별 손익 계산.
//
// 월말정산 화면(components/SettlementForm.tsx)이 클라이언트에서 하던 계산을
// 서버에서도 쓸 수 있게 옮겨 놓은 것. 당기순이익이 DB에 저장돼 있지 않아서
// (월정산에는 항목만 들어간다) 점장 평가의 자동 지표를 내려면 같은 식으로
// 다시 계산해야 한다. 두 곳의 계산이 어긋나면 안 되므로 식을 한 곳에 둔다.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type MonthlyPL = {
  month: string;
  totalSales: number;
  guests: number;
  purchaseTotal: number;
  fieldExpenseTotal: number;
  laborTotal: number;
  utilityTotal: number;
  hqFeeTotal: number;
  // 퇴직연금(인건비 10%) + 부가세·법인세(각 매출 6%) + 본사운영비(매출 4%)
  taxReserveTotal: number;
  discountTotal: number;
  totalExpense: number;
  netProfit: number;
  // 정산 데이터가 아예 없는 달인지. 없는 달을 적자 0원으로 오해하면 안 된다.
  hasData: boolean;
};

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function monthRange(month: string): { start: string; end: string } {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export async function monthlyPL(
  supabase: SupabaseClient<Database>,
  storeId: string,
  month: string
): Promise<MonthlyPL> {
  const { start, end } = monthRange(month);

  const [{ data: closings }, { data: receipts }, { data: fieldExpenses }, { data: settlement }] =
    await Promise.all([
    supabase
      .from("daily_closings")
      .select("grand_total, discount_amount, total_guests")
      .eq("store_id", storeId)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("receipts")
      .select("amount")
      .eq("store_id", storeId)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("field_expenses")
      .select("amount")
      .eq("store_id", storeId)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("monthly_settlements")
      .select("*")
      .eq("store_id", storeId)
      .eq("month", start)
      .maybeSingle(),
    ]);

  const totalSales = sum((closings ?? []).map((c) => c.grand_total));
  const guests = sum((closings ?? []).map((c) => c.total_guests));
  const discountTotal = sum((closings ?? []).map((c) => c.discount_amount));
  const purchaseTotal = sum((receipts ?? []).map((r) => r.amount));
  const fieldExpenseTotal = sum((fieldExpenses ?? []).map((r) => r.amount));

  // 공제총액(4대보험 등)도 매장이 실제 지출하는 인건비이므로 급여에 더한다.
  const laborTotal = sum(
    (settlement?.labor_items ?? []).map((i) => i.amount + (i.deduction ?? 0))
  );
  const utilityTotal = sum((settlement?.utility_items ?? []).map((i) => i.amount));
  const hqFeeTotal = sum((settlement?.hq_fee_items ?? []).map((i) => i.amount));

  // 세금·유보금은 월말정산과 같은 비율로 자동 산출한다.
  // 퇴직연금 인건비 10% / 부가세·법인세 각 매출 6% / 본사운영비 매출 4%.
  const taxReserveTotal =
    Math.round(laborTotal * 0.1) +
    Math.round(totalSales * 0.06) +
    Math.round(totalSales * 0.06) +
    Math.round(totalSales * 0.04);

  const totalExpense =
    purchaseTotal +
    fieldExpenseTotal +
    laborTotal +
    utilityTotal +
    hqFeeTotal +
    taxReserveTotal +
    discountTotal;

  return {
    month,
    totalSales,
    guests,
    purchaseTotal,
    fieldExpenseTotal,
    laborTotal,
    utilityTotal,
    hqFeeTotal,
    taxReserveTotal,
    discountTotal,
    totalExpense,
    netProfit: totalSales - totalExpense,
    // 마감도 정산도 없으면 데이터가 없는 달로 본다.
    hasData: (closings ?? []).length > 0 || !!settlement,
  };
}

export function monthsOfQuarter(period: string): string[] {
  const [yearStr, qStr] = period.split("-Q");
  const start = (Number(qStr) - 1) * 3 + 1;
  return [0, 1, 2].map((i) => `${yearStr}-${String(start + i).padStart(2, "0")}`);
}

export function previousQuarter(period: string): string {
  const [yearStr, qStr] = period.split("-Q");
  const q = Number(qStr);
  return q === 1 ? `${Number(yearStr) - 1}-Q4` : `${yearStr}-Q${q - 1}`;
}
