// 외부 API(토스·네이버·AI)를 여러 번 부르는 작업이라 기본 10초로는 모자란다. Hobby 플랜 최대 60초.
export const maxDuration = 60;

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { weekWindows, type AdStoreReport, type AdWeeklyReport } from "@/lib/adReport";
import AdReportClient from "@/components/AdReportClient";

// 네이버 검색광고 주간 리포트 — 지점장은 자기 매장, 본사 마스터는 연결된 전 매장.
export default async function AdReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle();
  const isManager = !!profile && profile.role === "owner" && !profile.department;
  if (!isManager) redirect("/");
  const isHqMaster = isManager && !profile!.store_id;
  // 광고 리포트는 지점장 전용 — 마스터는 키 설정 화면으로 보낸다.
  if (isHqMaster) redirect("/ad-report/settings");

  // 이미 만들어 둔 이번 주 저장본이 있으면 먼저 보여주고, 없으면 화면에서 만든다.
  const W = weekWindows();
  let q = supabase.from("ad_weekly_reports").select("store_id, report, generated_at").eq("week_start", W.week[0]);
  if (profile!.store_id) q = q.eq("store_id", profile!.store_id);
  const { data: cached } = await q;
  const initial: AdWeeklyReport | null = cached?.length
    ? {
        generatedAt: Math.min(...cached.map((c) => new Date(c.generated_at).getTime())),
        week: W.week,
        prev: W.prev,
        mtd: W.mtd,
        monthDays: W.monthDays,
        monthElapsed: W.monthElapsed,
        stores: cached.map((c) => c.report as unknown as AdStoreReport),
      }
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">광고 리포트</h1>
          <p className="mt-1 text-xs text-muted">
            지난주 {W.week[0].slice(5).replace("-", "/")}~{W.week[1].slice(5).replace("-", "/")} (월~일) · 네이버 검색광고 + 마감 매출
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Link href="/ad-report/insight" className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white">
            효율 분석
          </Link>
          {isHqMaster && (
            <Link href="/ad-report/settings" className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
              매장 키 설정
            </Link>
          )}
        </div>
      </div>
      <AdReportClient initial={initial} />
    </div>
  );
}
