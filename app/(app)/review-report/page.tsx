import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { storeColor } from "@/lib/storeColors";
import { kstDateString, kstShortDateLabel, kstWeekdayShortLabel } from "@/lib/date";
import { fetchReviewReports } from "@/lib/reviewReport";
import ReviewReportClient from "@/components/ReviewReportClient";

function buildDateEntries(days = 7) {
  return Array.from({ length: days }, (_, i) => {
    const date = kstDateString(i);
    const [, m, d] = date.split("-").map(Number);
    const weekday = kstWeekdayShortLabel(date);
    return {
      date,
      tabLabel: i === 0 ? "오늘" : `${kstShortDateLabel(date)}(${weekday})`,
      titleLabel: `${m}월 ${d}일(${weekday}) 리뷰 리포트`,
    };
  });
}

export default async function ReviewReportPage() {
  const supabase = await createClient();
  const { stores } = await getStoreContext(supabase);

  const dateEntries = buildDateEntries(7);
  const dates = dateEntries.map((d) => d.date);
  const storeIds = stores.map((s) => s.id);

  const reports = await fetchReviewReports(supabase, storeIds, dates);

  const clientStores = stores.map((s) => ({
    id: s.id,
    name: s.name,
    color: storeColor(s.name),
  }));

  return <ReviewReportClient stores={clientStores} dates={dateEntries} reports={reports} />;
}
