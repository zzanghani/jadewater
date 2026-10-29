"use client";

import AdPeriodClient from "@/components/AdPeriodClient";
import AdReportClient from "@/components/AdReportClient";
import type { AdWeeklyReport } from "@/lib/adReport";

// 광고 리포트 본문: 기간 성과 카드 아래에 주간 할 일 카드(접힘). 탭 줄을 없애 홈을 한 흐름으로.
export default function AdReportShell({ initial }: { initial: AdWeeklyReport | null }) {
  return (
    <div className="flex flex-col gap-3">
      <AdPeriodClient />
      <AdReportClient initial={initial} />
    </div>
  );
}
