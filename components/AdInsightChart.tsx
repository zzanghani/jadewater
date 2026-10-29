"use client";

import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyRow } from "@/lib/adInsight";

// 매출(막대) 위에 광고비(선, 오른쪽 축)를 겹쳐 그린다.
// 비 온 날·공휴일·특이일은 막대 색을 확실히 다르게 해서 "그날만 왜 다른지"가 바로 보이게 한다.
const COLOR = {
  normal: "var(--brand)",
  rain: "#0ea5e9", // 하늘색 = 비
  holiday: "#f97316", // 주황 = 공휴일
  special: "#a855f7", // 보라 = 특이일
  cost: "#ef4444", // 광고비 선 (빨강)
} as const;

type Point = {
  label: string;
  date: string;
  sales: number;
  cost: number;
  kind: keyof typeof COLOR;
  tags: string[];
};

function kindOf(r: DailyRow): Point["kind"] {
  if (r.special) return "special";
  if (r.holiday) return "holiday";
  if ((r.rain ?? 0) >= 1) return "rain";
  return "normal";
}

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const won = (n: number) => Math.round(n).toLocaleString("ko-KR");

export default function AdInsightChart({ rows }: { rows: DailyRow[] }) {
  const data: Point[] = rows.map((r) => ({
    label: r.date.slice(5).replace("-", "/"),
    date: r.date,
    sales: r.sales ?? 0,
    cost: r.cost,
    kind: kindOf(r),
    tags: [r.special ? `특이일 · ${r.special}` : "", r.holiday ? "공휴일" : "", (r.rain ?? 0) >= 1 ? `비 ${r.rain}mm` : ""].filter(Boolean),
  }));
  const has = (k: Point["kind"]) => data.some((d) => d.kind === k);
  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 0, left: -4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} interval={6} />
            <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`)} width={46} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`)} width={36} />
            <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(0,0,0,0.06)" }} />
            <Bar yAxisId="l" dataKey="sales" radius={[3, 3, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.date} fill={COLOR[d.kind]} />
              ))}
            </Bar>
            <Line yAxisId="r" type="monotone" dataKey="cost" stroke={COLOR.cost} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        <Chip color={COLOR.normal} label="매출" />
        {has("rain") && <Chip color={COLOR.rain} label="비 온 날(1mm↑)" />}
        {has("holiday") && <Chip color={COLOR.holiday} label="공휴일" />}
        {has("special") && <Chip color={COLOR.special} label="특이일" />}
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 rounded" style={{ background: COLOR.cost }} />
          광고비
        </span>
      </div>
    </div>
  );
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

// 마우스를 올리면 그날의 날짜·요일·날씨·매출·광고비·효율을 한 상자에 보여준다.
function ChartTip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const [y, m, day] = d.date.split("-").map(Number);
  const wd = WD[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  const roas = d.sales && d.cost ? (d.sales / d.cost) * 100 : null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg" style={{ minWidth: 170 }}>
      <p className="font-bold">
        {m}/{day} ({wd})
      </p>
      {d.tags.length > 0 && (
        <p className="mt-0.5 font-semibold" style={{ color: COLOR[d.kind] }}>
          {d.tags.join(" · ")}
        </p>
      )}
      <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
        <span className="text-muted">매출</span>
        <span className="text-right font-semibold">{d.sales ? won(d.sales) + "원" : "-"}</span>
        <span className="text-muted">광고비</span>
        <span className="text-right font-semibold" style={{ color: COLOR.cost }}>
          {d.cost ? won(d.cost) + "원" : "-"}
        </span>
        <span className="text-muted">광고비 대비 매출</span>
        <span className="text-right font-semibold">{roas == null ? "-" : won(roas) + "%"}</span>
      </div>
    </div>
  );
}
