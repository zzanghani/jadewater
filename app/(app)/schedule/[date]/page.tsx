import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { kstDateLabel } from "@/lib/date";
import ScheduleShiftForm from "@/components/ScheduleShiftForm";
import ScheduleDayTimeline from "@/components/ScheduleDayTimeline";
import ScheduleShiftList from "@/components/ScheduleShiftList";

export default async function ScheduleDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const supabase = await createClient();
  const { storeId } = await getStoreContext(supabase);

  // 새로 등록되는 근무자가 항상 아래쪽에 쌓이도록 근무 시간이 아닌
  // 등록된 순서(created_at) 기준으로 정렬한다.
  const { data: shifts } = await supabase
    .from("schedule_shifts")
    .select("*")
    .eq("store_id", storeId)
    .eq("date", date)
    .order("created_at", { ascending: true });

  const rows = shifts ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/schedule?month=${date.slice(0, 7)}`}
        className="flex items-center gap-1 text-sm font-medium text-muted"
      >
        <span aria-hidden>←</span> 달력으로
      </Link>

      <h1 className="text-lg font-bold">{kstDateLabel(date)} 근무자</h1>

      <ScheduleDayTimeline shifts={rows} />

      <ScheduleShiftList shifts={rows} date={date} />

      <ScheduleShiftForm date={date} />
    </div>
  );
}
