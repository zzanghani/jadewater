export const maxDuration = 60;

import AdPageHeader from "@/components/AdPageHeader";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adReportAllowedFor } from "@/lib/adAccess";
import { getStoreContext } from "@/lib/store";
import AdSearchClient from "@/components/AdSearchClient";

// 검색 노출 — 손님이 검색하는 말로 네이버 지도·블로그에 우리 가게가 보이는지, 월 검색량은 얼마인지.
export default async function AdSearchPage() {
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
      <AdPageHeader back="/ad-report" backLabel="광고 리포트" title="검색 노출" desc="네이버 지도 순위 · 블로그 상위30 · 월 검색량" />
      <AdSearchClient key={storeId} storeId={storeId} />
    </div>
  );
}
