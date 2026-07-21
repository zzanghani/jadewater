"use client";

import { useState } from "react";
import { formatWon } from "@/lib/format";
import type { PeriodRow } from "@/lib/periodBreakdown";
import type { StoreSeries } from "./MultiStoreChart";

export default function PeriodSummaryToggle({
  weekly,
  monthly,
  series,
}: {
  weekly: PeriodRow[];
  monthly: PeriodRow[];
  series: StoreSeries[];
}) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const rows = mode === "week" ? weekly : monthly;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">이번달 총매출</h2>
        <div className="flex rounded-full border border-border p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode("week")}
            className={`rounded-full px-3 py-1 transition-colors ${
              mode === "week" ? "bg-brand text-white" : "text-muted"
            }`}
          >
            주단위
          </button>
          <button
            type="button"
            onClick={() => setMode("month")}
            className={`rounded-full px-3 py-1 transition-colors ${
              mode === "month" ? "bg-brand text-white" : "text-muted"
            }`}
          >
            월단위
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 pr-2 font-medium">기간</th>
              {series.map((s) => (
                <th key={s.key} className="px-2 pb-2 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name.replace("제이드앤워터 ", "")}
                  </span>
                </th>
              ))}
              <th className="pb-2 pl-2 text-right font-medium">합계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="py-2 pr-2 font-medium text-foreground">{row.label}</td>
                {series.map((s) => (
                  <td key={s.key} className="px-2 py-2 text-right text-muted">
                    {formatWon(row.byStore[s.key] ?? 0)}
                  </td>
                ))}
                <td className="py-2 pl-2 text-right font-bold text-foreground">
                  {formatWon(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
