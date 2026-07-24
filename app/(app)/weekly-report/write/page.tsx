import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { weekDatesKST, weekRangeLabel } from "@/lib/date";
import WeeklyReportForm from "@/components/WeeklyReportForm";

export default async function WeeklyReportWritePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: weekParam } = await searchParams;
  const supabase = await createClient();
  const { storeId, stores } = await getStoreContext(supabase);
  const isMaster = stores.length > 1;

  if (isMaster) redirect("/weekly-report");

  const weekStart = weekParam || weekDatesKST(0)[0];

  const { data: existing } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("store_id", storeId)
    .eq("week_start", weekStart)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/weekly-report"
        className="flex items-center gap-1 text-sm font-medium text-muted"
      >
        <span aria-hidden>←</span> 목록으로
      </Link>

      <WeeklyReportForm
        storeId={storeId}
        weekStart={weekStart}
        weekLabel={weekRangeLabel(weekStart)}
        existing={existing ?? undefined}
      />
    </div>
  );
}
