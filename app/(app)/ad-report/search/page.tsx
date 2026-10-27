export const maxDuration = 60;

import Link from "next/link";
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
        <h1 className="mt-1 text-lg font-bold">검색 노출</h1>
        <p className="mt-1 text-xs text-muted">{storeName} · 네이버 지도 상위 5 · 블로그 상위 30 · 월 검색량 · 매일 새벽 자동 확인</p>
      </div>
      <AdSearchClient key={storeId} storeId={storeId} />
    </div>
  );
}
