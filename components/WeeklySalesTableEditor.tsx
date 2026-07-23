"use client";

import { useState } from "react";
import type { WeeklySalesRow } from "@/lib/types";

const DEFAULT_ROWS: WeeklySalesRow[] = [
  { label: "실매출", lastWeek: "", thisWeek: "" },
  { label: "주문건", lastWeek: "", thisWeek: "" },
  { label: "할인", lastWeek: "", thisWeek: "" },
  { label: "배달", lastWeek: "", thisWeek: "" },
  { label: "객단가", lastWeek: "", thisWeek: "" },
];

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return keySeq;
}

export default function WeeklySalesTableEditor({
  fieldName,
  initial,
}: {
  fieldName: string;
  initial: WeeklySalesRow[];
}) {
  const [rows, setRows] = useState(() =>
    (initial.length > 0 ? initial : DEFAULT_ROWS).map((r) => ({ ...r, key: nextKey() }))
  );

  function update(key: number, patch: Partial<WeeklySalesRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function add() {
    setRows((prev) => [...prev, { key: nextKey(), label: "", lastWeek: "", thisWeek: "" }]);
  }
  function remove(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const jsonValue = JSON.stringify(
    rows
      .filter((r) => r.label.trim())
      .map(({ label, lastWeek, thisWeek }) => ({ label, lastWeek, thisWeek }))
  );

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={fieldName} value={jsonValue} readOnly />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-medium">항목</th>
              <th className="pb-2 font-medium">전주</th>
              <th className="pb-2 font-medium">금주</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => update(row.key, { label: e.target.value })}
                    className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none ring-brand/30 focus:ring-2"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    value={row.lastWeek}
                    onChange={(e) => update(row.key, { lastWeek: e.target.value })}
                    className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none ring-brand/30 focus:ring-2"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    value={row.thisWeek}
                    onChange={(e) => update(row.key, { thisWeek: e.target.value })}
                    className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none ring-brand/30 focus:ring-2"
                  />
                </td>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() => remove(row.key)}
                    aria-label="삭제"
                    className="rounded-lg p-1.5 text-muted hover:text-red-500"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={add}
        className="w-full rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand"
      >
        + 항목 추가
      </button>
    </div>
  );
}
