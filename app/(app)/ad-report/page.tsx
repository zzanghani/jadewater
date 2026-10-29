// 외부 API(토스·네이버·AI)를 여러 번 부르는 작업이라 기본 10초로는 모자란다. Hobby 플랜 최대 60초.
export const maxDuration = 60;

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adReportAllowedFor } from "@/lib/adAccess";
import { weekWindows, type AdStoreReport, type AdWeeklyReport } from "@/lib/adReport";
import AdReportShell from "@/components/AdReportShell";

function MenuTile({ href, title, sub, primary = false }: { href: string; title: string; sub: string; primary?: boolean }) {
  return (
    <Link href={href} className={`flex flex-col rounded-2xl px-4 py-3 ${primary ? "bg-brand text-white shadow-md shadow-brand/20" : "border border-border bg-card"}`}>
      <span className="text-[15px] font-bold leading-tight">{title}</span>
      <span className={`mt-1 text-[11px] leading-snug ${primary ? "text-white/80" : "text-muted"}`}>{sub}</span>
    </Link>
  );
}

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
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold leading-tight">광고 리포트</h1>
          <p className="text-xs text-muted">네이버 검색광고 × 토스·마감 매출</p>
        </div>
        {isHqMaster && (
          <Link href="/ad-report/settings" className="shrink-0 text-xs font-semibold text-muted underline-offset-2 hover:underline">
            매장 키 설정
          </Link>
        )}
      </div>
      {/* 메뉴 — 네 화면을 같은 모양으로 한 덩어리에. 효율 분석만 채워서 첫 번째라는 걸 보여준다. */}
      <div className="grid grid-cols-2 gap-2">
        <MenuTile href="/ad-report/insight" title="효율 분석" sub="실시간 매출 × 광고비 · AI 전략" primary />
        <MenuTile href="/ad-report/manage" title="광고 관리" sub="캠페인 켜기/끄기 · 하루 예산" />
        <MenuTile href="/ad-report/hours" title="시간·요일 분석" sub="매출 피크 vs 광고 나가는 시간" />
        <MenuTile href="/ad-report/search" title="검색 노출" sub="지도 순위 · 블로그 우리 글" />
      </div>
      <AdReportShell initial={initial} />
    </div>
  );
}
