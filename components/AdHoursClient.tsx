"use client";

import { useEffect, useState, useTransition } from "react";
import { loadHours, type HoursResult } from "@/app/(app)/ad-report/hours/actions";
import type { HoursAnalysis } from "@/lib/adHours";

const won = (n: number | null | undefined) => (n == null || !isFinite(n) ? "-" : Math.round(n).toLocaleString("ko-KR"));
const man = (n: number) => (n >= 10000 ? `${Math.round(n / 10000).toLocaleString("ko-KR")}만` : won(n));

export default function AdHoursClient({ storeId }: { storeId: string }) {
  const [res, setRes] = useState<HoursResult | null>(null);
  const [loading, start] = useTransition();
  const [metric, setMetric] = useState<"sales" | "cost">("sales");
  useEffect(() => {
    start(async () => setRes(await loadHours(storeId)));
  }, [storeId]);
  if (!res) return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">{loading ? "불러오는 중..." : ""}</p>;
  if (!res.ok) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{res.error}</p>;
  const a = res.analysis;
  return (
    <div className="flex flex-col gap-4">
      {/* 운영 방향 */}
      <section className="rounded-2xl border border-brand bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">운영 방향</h2>
        <ul className="flex flex-col gap-1.5">
          {a.notes.map((n, i) => (
            <li key={i} className="flex gap-2 text-xs leading-snug">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
        {a.days > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[11px]">
            <div className="rounded-xl bg-background py-2">
              <p className="text-muted">영업시간(매출 기준)</p>
              <p className="font-bold">{a.openHours.length ? `${a.openHours[0]}~${a.openHours[a.openHours.length - 1] + 1}시` : "-"}</p>
            </div>
            <div className="rounded-xl bg-background py-2">
              <p className="text-muted">매출 피크</p>
              <p className="font-bold">{a.peakHours.map((h) => `${h}시`).join("·") || "-"}</p>
            </div>
            <div className="rounded-xl bg-background py-2">
              <p className="text-muted">영업시간 밖 광고비</p>
              <p className={`font-bold ${a.outsidePct != null && a.outsidePct >= 10 ? "text-red-600" : ""}`}>{a.outsidePct == null ? "-" : `${a.outsidePct.toFixed(0)}%`}</p>
            </div>
          </div>
        )}
      </section>

      {/* 시간대별 매출 vs 광고비 */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-bold">시간대별 매출과 광고비</h2>
        <p className="mb-2 text-[11px] text-muted">막대 = 매출(28일 합), 빨간 선 = 광고비. 광고가 매출 피크보다 1~3시간 앞서 나가야 해요.</p>
        <HourBars a={a} />
      </section>

      {/* 요일×시간 히트맵 */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold">요일 × 시간 (영업일 평균)</h2>
          <div className="flex rounded-lg bg-background p-0.5 text-[11px]">
            <button type="button" onClick={() => setMetric("sales")} className={`rounded-md px-2 py-1 ${metric === "sales" ? "bg-card font-semibold shadow-sm" : "text-muted"}`}>
              매출
            </button>
            <button type="button" onClick={() => setMetric("cost")} className={`rounded-md px-2 py-1 ${metric === "cost" ? "bg-card font-semibold shadow-sm" : "text-muted"}`} disabled={!a.adConnected}>
              광고비
            </button>
          </div>
        </div>
        <Heatmap a={a} metric={metric} />
      </section>

      {/* 요일별 성과 */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">요일별 성과</h2>
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-1 font-medium">요일</th>
              <th className="pb-1 text-right font-medium">매출(일평균)</th>
              <th className="pb-1 text-right font-medium">광고비(일평균)</th>
              <th className="pb-1 text-right font-medium">광고비 대비</th>
              <th className="pb-1 text-right font-medium">클릭당</th>
            </tr>
          </thead>
          <tbody>
            {a.weekday.map((w) => (
              <tr key={w.wd} className="border-t border-border">
                <td className="py-1.5 font-semibold">
                  {w.label}
                  {w.lowEff && <span className="ml-1 rounded bg-amber-50 px-1 text-[9px] font-bold text-amber-700">효율 낮음</span>}
                </td>
                <td className="py-1.5 text-right">{w.days ? man(w.sales / w.days) : "-"}</td>
                <td className="py-1.5 text-right">{w.days ? won(w.cost / w.days) : "-"}</td>
                <td className="py-1.5 text-right">{w.roas == null ? "-" : won(w.roas) + "%"}</td>
                <td className="py-1.5 text-right">{won(w.cpc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function HourBars({ a }: { a: HoursAnalysis }) {
  const maxS = Math.max(1, ...a.hours.map((h) => h.sales));
  const maxC = Math.max(1, ...a.hours.map((h) => h.cost));
  const focus = new Set(a.adFocusHours);
  const peak = new Set(a.peakHours);
  return (
    <div>
      <div className="relative flex h-40 items-end gap-[3px]">
        {a.hours.map((h) => (
          <div key={h.hour} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className={`w-full rounded-t ${peak.has(h.hour) ? "bg-brand" : "bg-brand/35"}`} style={{ height: `${(h.sales / maxS) * 100}%` }} />
            {a.adConnected && <div className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500" style={{ bottom: `${(h.cost / maxC) * 100}%` }} />}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-2 py-1 text-[10px] shadow group-hover:block">
              {h.hour}시 · 매출 {man(h.sales)} · 광고비 {won(h.cost)}원{h.roas != null && ` · ${won(h.roas)}%`}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {a.hours.map((h) => (
          <div key={h.hour} className={`flex-1 text-center text-[9px] ${focus.has(h.hour) ? "font-bold text-red-600" : "text-muted"}`}>
            {h.hour}
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted">진한 막대 = 매출 피크 · 빨간 숫자 = 광고 집중 추천 시간</p>
    </div>
  );
}

function Heatmap({ a, metric }: { a: HoursAnalysis; metric: "sales" | "cost" }) {
  // 광고비 히트맵은 시간대 합계를 요일 수로 나눠 근사 (요일별 시간대 광고비는 안 쌓아서)
  const hours = a.hours.map((h) => h.hour);
  const rows = a.heat.map((r) => ({
    label: r.label,
    days: r.days,
    cells: r.cells.map((c) => ({ hour: c.hour, v: metric === "sales" ? c.avg : 0 })),
  }));
  const max = metric === "sales" ? a.heatMax : 1;
  if (metric === "cost") {
    const maxC = Math.max(1, ...a.hours.map((h) => h.cost));
    return (
      <div className="text-[11px] text-muted">
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: `28px repeat(${hours.length}, minmax(0, 1fr))` }}>
          <div />
          {hours.map((h) => (
            <div key={h} className="text-center text-[9px]">{h}</div>
          ))}
          <div className="text-[10px] font-semibold text-foreground">합</div>
          {a.hours.map((h) => (
            <div key={h.hour} title={`${h.hour}시 광고비 ${won(h.cost)}원`} className="h-7 rounded-sm" style={{ background: `rgba(239,68,68,${0.1 + (h.cost / maxC) * 0.85})` }} />
          ))}
        </div>
        <p className="mt-1">광고비는 시간대 합계(28일)만 보여요. 요일별 광고비는 요일별 성과 표에서.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `28px repeat(${hours.length}, minmax(0, 1fr))` }}>
        <div />
        {hours.map((h) => (
          <div key={h} className="text-center text-[9px] text-muted">{h}</div>
        ))}
        {rows.map((r) => (
          <HeatRow key={r.label} r={r} max={max} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted">진할수록 그 요일·시간에 매출이 커요. 칸을 누르면 금액이 보여요.</p>
    </div>
  );
}

function HeatRow({ r, max }: { r: { label: string; days: number; cells: { hour: number; v: number }[] }; max: number }) {
  const [sel, setSel] = useState<number | null>(null);
  return (
    <>
      <div className="flex items-center text-[10px] font-semibold">
        {r.label}
        <span className="ml-0.5 text-[8px] font-normal text-muted">{r.days}</span>
      </div>
      {r.cells.map((c) => (
        <button key={c.hour} type="button" onClick={() => setSel(sel === c.hour ? null : c.hour)} className="relative h-7 rounded-sm" style={{ background: `rgba(30,41,139,${max ? 0.06 + (c.v / max) * 0.9 : 0.06})` }}>
          {sel === c.hour && <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow">{man(c.v)}</span>}
        </button>
      ))}
    </>
  );
}
