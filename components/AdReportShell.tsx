"use client";

import { useState } from "react";
import AdPeriodClient from "@/components/AdPeriodClient";
import AdReportClient from "@/components/AdReportClient";
import type { AdWeeklyReport } from "@/lib/adReport";

// 광고 리포트 본문: 두 탭으로 나눠 한 화면에 한 가지만. 둘 다 올려 두고 숨겨서 탭을 오가도 다시 읽지 않는다.
export default function AdReportShell({ initial }: { initial: AdWeeklyReport | null }) {
  const [tab, setTab] = useState<"period" | "weekly">("period");
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 rounded-xl bg-background p-1 text-sm font-semibold">
        <button type="button" onClick={() => setTab("period")} className={`rounded-lg py-2 ${tab === "period" ? "bg-card text-foreground shadow-sm" : "text-muted"}`}>
          기간 성과
        </button>
        <button type="button" onClick={() => setTab("weekly")} className={`rounded-lg py-2 ${tab === "weekly" ? "bg-card text-foreground shadow-sm" : "text-muted"}`}>
          주간 할 일
        </button>
      </div>
      <div className={tab === "period" ? "" : "hidden"}>
        <AdPeriodClient />
      </div>
      <div className={tab === "weekly" ? "" : "hidden"}>
        <AdReportClient initial={initial} />
      </div>
    </div>
  );
}
