// 외부 API(토스·네이버·AI)를 여러 번 부르는 작업이라 기본 10초로는 모자란다. Hobby 플랜 최대 60초.
export const maxDuration = 60;

import AdPageHeader from "@/components/AdPageHeader";
import AdStoreSelect from "@/components/AdStoreSelect";
import AdInsightClient from "@/components/AdInsightClient";
import { resolveAdPageScope } from "@/lib/adPage";

// 광고 효율 분석 — 토스 실시간 매출 × 네이버 광고. 머리글에서 매장을 고른다(마스터 전부·지점장은 같은 브랜드).
export default async function Page() {
  const { storeId, stores, canEdit } = await resolveAdPageScope();

  return (
    <div className="flex flex-col gap-4">
      <AdPageHeader back="/ad-report" backLabel="광고 리포트" title="광고 효율 분석" desc="토스 매출 × 네이버 광고 · 오늘은 실시간" action={<AdStoreSelect stores={stores} current={storeId} />} />
      <AdInsightClient key={storeId} storeId={storeId} canEdit={canEdit} />
    </div>
  );
}
