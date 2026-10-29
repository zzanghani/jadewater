export const maxDuration = 60;

import AdPageHeader from "@/components/AdPageHeader";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adReportAllowedFor } from "@/lib/adAccess";
import { getStoreContext } from "@/lib/store";
import AdHoursClient from "@/components/AdHoursClient";

// 시간·요일 분석 — 매출이 몰리는 시간과 광고비가 나가는 시간을 겹쳐 본다.
export default async function AdHoursPage() {
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
  if (!(await adReportAllowedFor(supabase, profile))) redirect("/");
  const storeId = profile!.store_id ?? contextStoreId;

  return (
    <div className="flex flex-col gap-4">
      <AdPageHeader back="/ad-report" backLabel="광고 리포트" title="시간·요일 분석" desc="최근 28일 · 시간대 매출 × 시간대 광고비" />
      <AdHoursClient key={storeId} storeId={storeId} />
    </div>
  );
}
