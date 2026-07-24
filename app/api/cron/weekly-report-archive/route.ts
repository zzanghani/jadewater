import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { archiveWeeklyReportToDrive } from "@/lib/weeklyReportArchive";
import { kstDateString } from "@/lib/date";

// Vercel Cron이 매일 KST 06:00에 호출한다 (vercel.json 참고).
// 작성 기간(월~일)이 완전히 지난 주간보고 중, 아직 백업 안 한 것을
// 구글드라이브에 PDF로 저장한다. Supabase 원본은 지우지 않는다.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // 그 주(월~일)가 끝난 다음날부터 대상. week_start가 월요일이므로
  // week_start + 7일(=다음주 월요일) 이하인 오늘이면 그 주는 이미 끝난 것.
  const today = kstDateString(0);

  const { data: reports, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .is("archived_at", null);

  if (error) {
    console.error("[weekly-report-archive] 대상 조회 실패", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const targets = (reports ?? []).filter((r) => {
    const weekEndNextDay = new Date(`${r.week_start}T00:00:00+09:00`);
    weekEndNextDay.setDate(weekEndNextDay.getDate() + 7);
    const cutoff = weekEndNextDay.toISOString().slice(0, 10);
    return today >= cutoff;
  });

  console.log(`[weekly-report-archive] 백업 대상 ${targets.length}건`);

  const storeIds = [...new Set(targets.map((r) => r.store_id))];
  const { data: stores } = storeIds.length
    ? await supabase.from("stores").select("id, name").in("id", storeIds)
    : { data: [] as { id: string; name: string }[] };
  const storeNameById = new Map((stores ?? []).map((s) => [s.id, s.name]));

  const results: Record<string, string> = {};

  for (const report of targets) {
    const storeName = storeNameById.get(report.store_id) ?? "알 수 없음";
    try {
      await archiveWeeklyReportToDrive(report, storeName);
      await supabase
        .from("weekly_reports")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", report.id);
      results[report.id] = "백업 완료";
      console.log(`[weekly-report-archive] report_id=${report.id} 백업 완료`);
    } catch (err) {
      results[report.id] = "백업 실패";
      console.error(`[weekly-report-archive] report_id=${report.id} 백업 실패`, err);
    }
  }

  return NextResponse.json({ results });
}
