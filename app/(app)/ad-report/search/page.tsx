export const maxDuration = 60;

import AdPageHeader from "@/components/AdPageHeader";
import AdStoreSelect from "@/components/AdStoreSelect";
import AdSearchClient from "@/components/AdSearchClient";
import { resolveAdPageScope } from "@/lib/adPage";

// 검색 노출 — 손님이 검색하는 말로 네이버 지도·블로그에 우리 가게가 보이는지, 월 검색량은 얼마인지.
export default async function Page() {
  const { storeId, stores, canEdit } = await resolveAdPageScope();

  return (
    <div className="flex flex-col gap-4">
      <AdPageHeader back="/ad-report" backLabel="광고 리포트" title="검색 노출" desc="네이버 지도 순위 · 블로그 상위30 · 월 검색량" action={<AdStoreSelect stores={stores} current={storeId} />} />
      <AdSearchClient key={storeId} storeId={storeId} canEdit={canEdit} />
    </div>
  );
}
