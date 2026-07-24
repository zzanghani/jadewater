"use client";

import { forwardRef, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { weekRangeLabel } from "@/lib/date";
import type { WeeklyReport } from "@/lib/types";

export default function WeeklyReportImage({
  storeName,
  report,
}: {
  storeName: string;
  report: WeeklyReport;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const weekLabel = weekRangeLabel(report.week_start);

  async function handleSaveImage() {
    if (!reportRef.current) return;
    setCapturing(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `${storeName}_${weekLabel.replace(/\s/g, "")}_주간보고.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setCapturing(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">주간보고 리포트</h2>
        <button
          type="button"
          onClick={handleSaveImage}
          disabled={capturing}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
        >
          {capturing ? "생성 중..." : "이미지로 저장"}
        </button>
      </div>

      <WeeklyReportCard ref={reportRef} storeName={storeName} weekLabel={weekLabel} report={report} />
    </section>
  );
}

function ReportListSection({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-sm font-bold">{label}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted">작성된 내용이 없습니다.</p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-1.5 text-sm">
              <span className="shrink-0 text-muted">{idx + 1}.</span>
              <span className="whitespace-pre-wrap">{item}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const WeeklyReportCard = forwardRef<
  HTMLDivElement,
  { storeName: string; weekLabel: string; report: WeeklyReport }
>(function WeeklyReportCard({ storeName, weekLabel, report }, ref) {
  return (
    <div
      ref={ref}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 text-[#1c2624]"
    >
      <div className="border-b border-border pb-3">
        <p className="text-lg font-bold">{storeName}</p>
        <p className="text-sm text-muted">{weekLabel} 주간보고</p>
      </div>

      <ReportListSection label="🎯 주간목표" items={report.goals} />
      <ReportListSection label="👥 HR - 진행상황" items={report.hr_items} />

      <div>
        <p className="mb-1 text-sm font-bold">💰 매출</p>
        {report.sales_notes.length > 0 && (
          <ol className="mb-2 flex flex-col gap-0.5">
            {report.sales_notes.map((item, idx) => (
              <li key={idx} className="flex gap-1.5 text-sm">
                <span className="shrink-0 text-muted">{idx + 1}.</span>
                <span className="whitespace-pre-wrap">{item}</span>
              </li>
            ))}
          </ol>
        )}
        {report.sales_table.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-1 font-medium">항목</th>
                <th className="pb-1 font-medium">전주</th>
                <th className="pb-1 font-medium">금주</th>
              </tr>
            </thead>
            <tbody>
              {report.sales_table.map((row, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="py-1 pr-2 font-medium">{row.label}</td>
                  <td className="py-1 pr-2 text-muted">{row.lastWeek}</td>
                  <td className="py-1 pr-2">{row.thisWeek}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ReportListSection label="⭐ 주간이슈" items={report.issues} />
      <ReportListSection label="🍳 키친" items={report.kitchen_items} />
      <ReportListSection label="🍽️ 홀" items={report.hall_items} />
    </div>
  );
});
