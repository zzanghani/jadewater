export const maxDuration = 60;

import Link from "next/link";
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
  const [{ data: profile }, { storeId: contextStoreId, storeName }] = await Promise.all([
    supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle(),
    getStoreContext(supabase),
  ]);
  const isManager = !!profile && profile.role === "owner" && !profile.department;
  if (!isManager) redirect("/");
  if (!(await adReportAllowedFor(supabase, profile))) redirect("/");
  const storeId = profile!.store_id ?? contextStoreId;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/ad-report/insight" className="text-xs text-muted">
          ‹ 효율 분석
        </Link>
        <h1 className="mt-1 text-lg font-bold">시간·요일 분석</h1>
        <p className="mt-1 text-xs text-muted">{storeName} · 최근 28일 · 토스 시간대 매출 × 네이버 시간대 광고비</p>
      </div>
      <AdHoursClient key={storeId} storeId={storeId} />
    </div>
  );
}
