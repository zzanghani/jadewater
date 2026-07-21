import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Review } from "./types";

export type PlatformSummary = {
  name: string;
  rating: number;
  count: number;
  change: number;
};

export type StoreReviewReport = {
  platforms: PlatformSummary[];
  newReviews: Review[];
  badReviews: Review[];
  analysis: string;
};

// date -> storeId -> StoreReviewReport
export type ReviewReportsByDate = Record<string, Record<string, StoreReviewReport>>;

export async function fetchReviewReports(
  supabase: SupabaseClient<Database>,
  storeIds: string[],
  dates: string[]
): Promise<ReviewReportsByDate> {
  const reports: ReviewReportsByDate = {};
  for (const date of dates) {
    reports[date] = {};
    for (const storeId of storeIds) {
      reports[date][storeId] = { platforms: [], newReviews: [], badReviews: [], analysis: "" };
    }
  }

  if (storeIds.length === 0 || dates.length === 0) {
    return reports;
  }

  const startDate = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
  const endDate = dates.reduce((max, d) => (d > max ? d : max), dates[0]);

  const [{ data: statRows }, { data: reviewRows }, { data: summaryRows }] = await Promise.all([
    supabase
      .from("review_platform_stats")
      .select("*")
      .in("store_id", storeIds)
      .gte("date", startDate)
      .lte("date", endDate),
    supabase
      .from("reviews")
      .select("*")
      .in("store_id", storeIds)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("created_at", { ascending: false }),
    supabase
      .from("review_ai_summaries")
      .select("*")
      .in("store_id", storeIds)
      .gte("date", startDate)
      .lte("date", endDate),
  ]);

  for (const row of statRows ?? []) {
    const cell = reports[row.date]?.[row.store_id];
    if (!cell) continue;
    cell.platforms.push({
      name: row.platform,
      rating: row.rating,
      count: row.review_count,
      change: row.change_count,
    });
  }

  for (const row of reviewRows ?? []) {
    const cell = reports[row.date]?.[row.store_id];
    if (!cell) continue;
    cell.newReviews.push(row);
    if (row.rating <= 3) {
      cell.badReviews.push(row);
    }
  }

  for (const row of summaryRows ?? []) {
    const cell = reports[row.date]?.[row.store_id];
    if (!cell) continue;
    cell.analysis = row.summary;
  }

  return reports;
}
