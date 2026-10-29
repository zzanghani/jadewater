// 외부 API(토스·네이버·AI)를 여러 번 부르는 작업이라 기본 10초로는 모자란다. Hobby 플랜 최대 60초.
export const maxDuration = 60;

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adReportAllowedFor } from "@/lib/adAccess";
import { weekWindows, type AdStoreReport, type AdWeeklyReport } from "@/lib/adReport";
import AdReportShell from "@/components/AdReportShell";

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
  // 시범 운영: 본사 마스터 + 성수 점장만 (lib/adAccess.ts)
  if (!(await adReportAllowedFor(supabase, profile))) redirect("/");
  const isHqMaster = isManager && !profile!.store_id;

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
          <p className="mt-1 text-xs text-muted">네이버 검색광고 × 토스·마감 매출</p>
        </div>
        {isHqMaster && (
          <Link href="/ad-report/settings" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
            매장 키 설정
          </Link>
        )}
      </div>
      {/* 큰 버튼 두 개 — 폰에서도 바로 누르게 */}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/ad-report/insight" className="flex flex-col items-center justify-center rounded-2xl bg-brand px-3 py-3 text-white shadow-md shadow-brand/20">
          <span className="text-base font-bold">효율 분석</span>
          <span className="mt-0.5 text-[11px] text-white/80">실시간 매출 × 광고비 · AI 전략</span>
        </Link>
        <Link href="/ad-report/manage" className="flex flex-col items-center justify-center rounded-2xl border-2 border-brand bg-card px-3 py-3 text-brand">
          <span className="text-base font-bold">광고 관리</span>
          <span className="mt-0.5 text-[11px] text-brand/80">캠페인 켜기/끄기 · 하루 예산</span>
        </Link>
      </div>
      {/* 자주 가는 보조 화면 — 효율 분석 안에만 숨어 있어 찾기 어려웠던 걸 여기서도 바로 */}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/ad-report/hours" className="rounded-xl border border-border bg-card px-3 py-2 text-center text-xs font-semibold">
          시간·요일 분석
        </Link>
        <Link href="/ad-report/search" className="rounded-xl border border-border bg-card px-3 py-2 text-center text-xs font-semibold">
          검색 노출
        </Link>
      </div>
      <AdReportShell initial={initial} />
    </div>
  );
}
