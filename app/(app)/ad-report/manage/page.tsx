export const maxDuration = 60;

import AdPageHeader from "@/components/AdPageHeader";
import AdStoreSelect from "@/components/AdStoreSelect";
import AdManageClient from "@/components/AdManageClient";
import { resolveAdPageScope } from "@/lib/adPage";

// 광고 관리 — 캠페인을 앱에서 켜고 끄고 하루 예산을 바꾼다. 바꾼 건 기록되고 7일 뒤 효과가 판정된다.
// 같은 브랜드 다른 매장은 보기만, 바꾸는 건 그 매장 지점장·마스터만.
export default async function Page() {
  const { storeId, stores, canEdit } = await resolveAdPageScope();

  return (
    <div className="flex flex-col gap-4">
      <AdPageHeader back="/ad-report" backLabel="광고 리포트" title="광고 관리" desc="캠페인 켜기/끄기 · 하루 예산 · 노출 시간" action={<AdStoreSelect stores={stores} current={storeId} />} />
      <AdManageClient key={storeId} storeId={storeId} canEdit={canEdit} />
    </div>
  );
}
