export const maxDuration = 60;

import AdPageHeader from "@/components/AdPageHeader";
import AdStoreSelect from "@/components/AdStoreSelect";
import AdHoursClient from "@/components/AdHoursClient";
import { resolveAdPageScope } from "@/lib/adPage";

// 시간·요일 분석 — 매출이 몰리는 시간과 광고비가 나가는 시간을 겹쳐 본다.
export default async function Page() {
  const { storeId, stores } = await resolveAdPageScope();

  return (
    <div className="flex flex-col gap-4">
      <AdPageHeader back="/ad-report" backLabel="광고 리포트" title="시간·요일 분석" desc="최근 28일 · 시간대 매출 × 시간대 광고비" action={<AdStoreSelect stores={stores} current={storeId} />} />
      <AdHoursClient key={storeId} storeId={storeId} />
    </div>
  );
}
