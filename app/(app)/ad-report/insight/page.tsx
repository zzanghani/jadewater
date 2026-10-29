// 외부 API(토스·네이버·AI)를 여러 번 부르는 작업이라 기본 10초로는 모자란다. Hobby 플랜 최대 60초.
export const maxDuration = 60;

import AdPageHeader from "@/components/AdPageHeader";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adReportAllowedFor } from "@/lib/adAccess";
import { getStoreContext } from "@/lib/store";
import AdInsightClient from "@/components/AdInsightClient";

// 광고 효율 분석 — 토스 실시간 매출 × 네이버 광고. 지점장은 자기 매장, 마스터는 상단 매장 선택.
export default async function AdInsightPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { storeId: contextStoreId }] = await Promise.all([
    supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle(),
    getStoreContext(supabase),
  ]);
  const isManager = !!profile && profile.role === "owner" && !profile.department;
  if (!isManager) redirect("/");
  // 시범 운영: 본사 마스터 + 성수 점장만 (lib/adAccess.ts)
  if (!(await adReportAllowedFor(supabase, profile))) redirect("/");
  const storeId = profile!.store_id ?? contextStoreId;

  return (
    <div className="flex flex-col gap-4">
      <AdPageHeader back="/ad-report" backLabel="광고 리포트" title="광고 효율 분석" desc="토스 매출 × 네이버 광고 · 오늘은 실시간" />
      <AdInsightClient key={storeId} storeId={storeId} />
    </div>
  );
}
