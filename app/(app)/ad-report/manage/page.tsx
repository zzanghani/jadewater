export const maxDuration = 60;

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adReportAllowedFor } from "@/lib/adAccess";
import { getStoreContext } from "@/lib/store";
import AdManageClient from "@/components/AdManageClient";

// 광고 관리 — 캠페인을 앱에서 켜고 끄고 하루 예산을 바꾼다. 바꾼 건 기록되고 7일 뒤 효과가 판정된다.
export default async function AdManagePage() {
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
  // 시범 운영: 본사 마스터 + 성수 점장만 (lib/adAccess.ts)
  if (!(await adReportAllowedFor(supabase, profile))) redirect("/");
  const storeId = profile!.store_id ?? contextStoreId;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/ad-report" className="text-xs text-muted">
          ‹ 광고 리포트
        </Link>
        <h1 className="mt-1 text-lg font-bold">광고 관리</h1>
        <p className="mt-1 text-xs text-muted">{storeName} · 네이버 검색광고 캠페인 켜기/끄기 · 하루 예산 · 변경 효과</p>
      </div>
      <AdManageClient key={storeId} storeId={storeId} />
    </div>
  );
}
