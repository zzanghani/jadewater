"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatWon } from "@/lib/format";

export type WeeklyPoint = {
  label: string;
  food: number;
  beverage: number;
  wine: number;
};

const NAME_LABEL: Record<string, string> = {
  food: "음식매출",
  beverage: "음료매출",
  wine: "와인매출",
};

export default function WeeklySalesChart({ data }: { data: WeeklyPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`
            }
            width={36}
          />
          <Tooltip
            formatter={(value, name) => [
              formatWon(Number(value)),
              NAME_LABEL[String(name)] ?? String(name),
            ]}
            labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(name) => NAME_LABEL[String(name)] ?? String(name)}
            wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
          />
          <Bar dataKey="food" stackId="s" fill="var(--brand-dark)" barSize={22} />
          <Bar dataKey="beverage" stackId="s" fill="var(--brand)" barSize={22} />
          <Bar
            dataKey="wine"
            stackId="s"
            fill="var(--brand-light)"
            radius={[6, 6, 0, 0]}
            barSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
