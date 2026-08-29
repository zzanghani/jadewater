"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { monthlyPL, monthsOfQuarter, previousQuarter } from "@/lib/storePL";
import {
  applyProfitGate,
  autoScoreManager,
  managerGrade,
  MANAGER_ITEMS,
  type ManagerAutoInput,
} from "@/lib/managerEval";

export type ManagerEvalState = { error?: string; success?: boolean } | undefined;

function quarterRange(period: string): { start: string; end: string; days: number } {
  const months = monthsOfQuarter(period);
  const year = Number(period.slice(0, 4));
  const lastMonth = Number(months[2].slice(5, 7));
  const lastDay = new Date(Date.UTC(year, lastMonth, 0)).getUTCDate();
  const start = `${months[0]}-01`;
  const end = `${months[2]}-${String(lastDay).padStart(2, "0")}`;
  const days =
    Math.round(
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000
    ) + 1;
  return { start, end, days };
}

// 앱 데이터에서 자동 지표를 뽑는다. 채점 화면과 확정 시점에 같은 함수를 쓴다 —
// 화면에 보이는 근거와 굳혀지는 점수가 어긋나면 안 된다.
export async function collectManagerAuto(storeId: string, period: string) {
  const supabase = await createClient();
  const months = monthsOfQuarter(period);
  const prev = previousQuarter(period);
  const prevMonths = monthsOfQuarter(prev);
  const { start, end, days } = quarterRange(period);
  const prevRange = quarterRange(prev);

  const [nowPL, prevPL] = await Promise.all([
    Promise.all(months.map((m) => monthlyPL(supabase, storeId, m))),
    Promise.all(prevMonths.map((m) => monthlyPL(supabase, storeId, m))),
  ]);

  const [
    { data: closings },
    { data: resigned },
    { data: weeklies },
    { data: counts },
    { data: reviewsNow },
    { data: reviewsPrev },
  ] = await Promise.all([
    supabase
      .from("daily_closings")
      .select("date")
      .eq("store_id", storeId)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("employees")
      .select("id")
      .eq("store_id", storeId)
      .eq("employment_type", "정직원")
      .gte("resigned_at", start)
      .lte("resigned_at", end),
    supabase
      .from("weekly_reports")
      .select("week_start")
      .eq("store_id", storeId)
      .gte("week_start", start)
      .lte("week_start", end),
    supabase
      .from("inventory_counts")
      .select("id, date")
      .eq("store_id", storeId)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("review_platform_stats")
      .select("rating, date")
      .eq("store_id", storeId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .limit(20),
    supabase
      .from("review_platform_stats")
      .select("rating, date")
      .eq("store_id", storeId)
      .gte("date", prevRange.start)
      .lte("date", prevRange.end)
      .order("date", { ascending: false })
      .limit(20),
  ]);

  const avgRating = (rows: { rating: number }[] | null) => {
    const valid = (rows ?? []).filter((r) => r.rating > 0);
    if (valid.length === 0) return null;
    return valid.reduce((s, r) => s + r.rating, 0) / valid.length;
  };

  // 실사는 품목별로 여러 행이 들어오므로 "실사한 달"의 수로 센다.
  const countMonths = new Set((counts ?? []).map((c) => String(c.date).slice(0, 7))).size;

  const input: ManagerAutoInput = {
    months: nowPL.map((m) => ({
      month: m.month,
      totalSales: m.totalSales,
      netProfit: m.netProfit,
      hasData: m.hasData,
    })),
    prevQuarterSales: prevPL.filter((m) => m.hasData).reduce((s, m) => s + m.totalSales, 0),
    prevQuarterProfit: prevPL.filter((m) => m.hasData).reduce((s, m) => s + m.netProfit, 0),
    resignedCount: (resigned ?? []).length,
    reviewRatingNow: avgRating(reviewsNow),
    reviewRatingPrev: avgRating(reviewsPrev),
    closingDays: new Set((closings ?? []).map((c) => c.date)).size,
    quarterDays: days,
    weeklyReports: (weeklies ?? []).length,
    inventoryCountMonths: countMonths,
  };

  const result = autoScoreManager(input);
  const quarterProfit = nowPL.filter((m) => m.hasData).reduce((s, m) => s + m.netProfit, 0);

  return { ...result, input, quarterProfit, monthly: nowPL };
}

export async function saveManagerScores(
  _prevState: ManagerEvalState,
  formData: FormData
): Promise<ManagerEvalState> {
  const supabase = await createClient();

  const employeeId = String(formData.get("employee_id") ?? "");
  const period = String(formData.get("period") ?? "");
  const storeId = String(formData.get("store_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const gateExempt = formData.get("gate_exempt") === "on";

  if (!employeeId || !period || !storeId) return { error: "대상이 올바르지 않습니다." };

  const auto = await collectManagerAuto(storeId, period);

  const scores: Record<string, number> = {};
  for (const item of MANAGER_ITEMS) {
    if (item.auto) {
      // 자동 항목은 폼 값을 믿지 않고 서버에서 다시 계산한 값만 쓴다.
      if (typeof auto.scores[item.id] === "number") scores[item.id] = auto.scores[item.id];
      continue;
    }
    const raw = formData.get(`score_${item.id}`);
    if (raw === null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > item.max) {
      return { error: `${item.name}은 0~${item.max}점만 넣을 수 있습니다.` };
    }
    scores[item.id] = value;
  }

  const { error } = await supabase.from("manager_reviews").upsert(
    {
      employee_id: employeeId,
      period,
      store_id: storeId,
      scores,
      auto_snapshot: { notes: auto.notes, input: auto.input },
      comment: comment || null,
      gate_exempt: gateExempt,
      quarter_profit: auto.quarterProfit,
    },
    { onConflict: "employee_id,period" }
  );

  if (error) return { error: "저장하지 못했습니다. 권한을 확인해 주세요." };

  revalidatePath("/hr");
  return { success: true };
}

export async function finalizeManagerReview(reviewId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: review } = await supabase
    .from("manager_reviews")
    .select("*")
    .eq("id", reviewId)
    .single();
  if (!review) return { error: "평가를 찾을 수 없습니다." };
  if (!review.store_id) return { error: "매장 정보가 없습니다." };

  const auto = await collectManagerAuto(review.store_id, review.period);

  // 자동 항목은 확정 시점에 다시 계산해 덮어쓴다.
  const scores = { ...review.scores, ...auto.scores };

  const missing = MANAGER_ITEMS.filter(
    (i) => !i.auto && typeof scores[i.id] !== "number"
  );
  if (missing.length > 0) {
    return { error: `아직 채점하지 않은 항목이 ${missing.length}개 있습니다.` };
  }

  const total = MANAGER_ITEMS.reduce((sum, i) => sum + (scores[i.id] ?? 0), 0);
  const { grade } = managerGrade(total);
  const gated = applyProfitGate(grade, auto.quarterProfit, review.gate_exempt);

  const { error } = await supabase
    .from("manager_reviews")
    .update({
      scores,
      auto_snapshot: { notes: auto.notes, input: auto.input },
      total_score: total,
      grade: gated.grade,
      gate_applied: gated.gated,
      quarter_profit: auto.quarterProfit,
      finalized_at: new Date().toISOString(),
      finalized_by: user?.id ?? null,
    })
    .eq("id", reviewId);

  if (error) return { error: "확정하지 못했습니다." };

  revalidatePath("/hr");
  return {};
}
