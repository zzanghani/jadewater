"use client";

import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyRow } from "@/lib/adInsight";

// 매출(막대) 위에 광고비(선, 오른쪽 축)를 겹쳐 그린다.
export default function AdInsightChart({ rows }: { rows: DailyRow[] }) {
  // 비 온 날은 연하게, 공휴일·특이일은 회색으로 그려 "왜 그날만 다른지"가 한눈에 보이게 한다.
  const data = rows.map((r) => ({
    label: r.date.slice(5).replace("-", "/"),
    sales: r.sales ?? 0,
    cost: r.cost,
    fill: r.holiday || r.special ? "#9ca3af" : (r.rain ?? 0) >= 1 ? "color-mix(in srgb, var(--brand) 45%, white)" : "var(--brand)",
    note: [r.special, r.holiday ? "공휴일" : "", (r.rain ?? 0) >= 1 ? `비 ${r.rain}mm` : ""].filter(Boolean).join(" · "),
  }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} interval={6} />
          <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`)} width={36} />
          <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`)} width={36} />
          <Tooltip
            formatter={(value, name) => [`${Math.round(Number(value)).toLocaleString()}원`, name === "sales" ? "매출" : "광고비"]}
            labelFormatter={(label, payload) => {
              const n = (payload?.[0]?.payload as { note?: string } | undefined)?.note;
              return n ? `${label} · ${n}` : String(label);
            }}
            contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid var(--border)" }}
          />
          <Bar yAxisId="l" dataKey="sales" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
          <Line yAxisId="r" type="monotone" dataKey="cost" stroke="#2563eb" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
