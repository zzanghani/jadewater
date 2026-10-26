"use client";

import { useEffect, useState, useTransition } from "react";
import { loadAdPeriod, type PeriodResult, type PeriodStore } from "@/app/(app)/ad-report/period-actions";
import { PERIOD_LABEL, type PeriodAgg, type PeriodKey } from "@/lib/adPeriod";
import { pctDelta, won } from "@/lib/adReport";

const KEYS: PeriodKey[] = ["today", "yesterday", "7d", "30d", "month", "lastMonth", "custom"];

function deltaTxt(d: number | null) {
  if (d == null) return "-";
  const arrow = d > 0.5 ? "▲" : d < -0.5 ? "▼" : "";
  return `${arrow}${Math.abs(d).toFixed(0)}%`;
}
function deltaClass(d: number | null, goodUp: boolean) {
  if (d == null || Math.abs(d) < 0.5) return "text-muted";
  return (d > 0) === goodUp ? "text-green-700" : "text-red-600";
}
const md = (ymd: string) => ymd.slice(5).replace("-", "/");

export default function AdPeriodClient() {
  const [key, setKey] = useState<PeriodKey>("today");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [res, setRes] = useState<PeriodResult | null>(null);
  const [loading, start] = useTransition();

  // 기간을 고르면 바로 조회한다 (직접 선택은 '적용'을 눌러야).
  useEffect(() => {
    if (key === "custom") return;
    start(async () => setRes(await loadAdPeriod(key)));
  }, [key]);

  function applyCustom() {
    if (!custom.from || !custom.to) return;
    start(async () => setRes(await loadAdPeriod("custom", custom)));
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKey(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${key === k ? "bg-brand text-white" : "border border-border bg-card text-foreground"}`}
          >
            {PERIOD_LABEL[k]}
          </button>
        ))}
      </div>
      {key === "custom" && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground" />
          <span className="text-muted">~</span>
          <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground" />
          <button type="button" onClick={applyCustom} disabled={loading || !custom.from || !custom.to} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-40">
            적용
          </button>
          <span className="text-[11px] text-muted">최대 93일</span>
        </div>
      )}

      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          {res ? "불러오는 중…" : "네이버·토스에서 읽는 중… 처음 보는 기간은 20~40초 걸릴 수 있어요."}
        </p>
      )}
      {res && !res.ok && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{res.error}</p>}
      {res?.ok && (
        <>
          <p className="text-xs text-muted">
            {res.range.from === res.range.to ? md(res.range.from) : `${md(res.range.from)}~${md(res.range.to)}`}
            {res.range.to === res.today && " · 오늘은 실시간"} · 비교: {res.range.cmpLabel}
          </p>
          {res.total && <AggCard title="전 매장 합계" cur={res.total.cur} cmp={res.total.cmp} highlight />}
          {res.stores.map((s) => (
            <StoreAgg key={s.storeId} s={s} />
          ))}
        </>
      )}
    </section>
  );
}

function StoreAgg({ s }: { s: PeriodStore }) {
  const note = [!s.adConnected && "광고 미연결", !s.tossLinked && "매출은 마감입력 기준", s.error && `일부 못 읽음: ${s.error}`].filter(Boolean).join(" · ");
  return <AggCard title={s.name} cur={s.cur} cmp={s.cmp} note={note} />;
}

function AggCard({ title, cur, cmp, note, highlight = false }: { title: string; cur: PeriodAgg; cmp: PeriodAgg; note?: string; highlight?: boolean }) {
  const salesSub = highlight ? "" : cur.sales != null && cur.days > 1 ? `${cur.salesDays}일` : "";
  const convTracked = cur.conv > 0 || cmp.conv > 0;
  return (
    <div className={`rounded-2xl border bg-card p-4 ${highlight ? "border-brand" : "border-border"}`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {note && <span className="text-[11px] text-muted">{note}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Kpi label="광고비" cur={cur.cost} cmp={cmp.cost} unit="원" goodUp={false} />
        <Kpi label="매출" cur={cur.sales} cmp={cmp.sales} unit="원" goodUp sub={salesSub} />
        <Kpi label="광고비 대비 매출" cur={cur.roas} cmp={cmp.roas} unit="%" goodUp sub={cur.adShare == null ? "" : `매출의 ${cur.adShare.toFixed(1)}%`} />
        <Kpi label="클릭" cur={cur.clk} cmp={cmp.clk} goodUp sub={cur.ctr == null ? "" : `클릭률 ${cur.ctr.toFixed(2)}%`} />
        <Kpi label="클릭 한 번 값" cur={cur.cpc} cmp={cmp.cpc} unit="원" goodUp={false} />
        {convTracked ? <Kpi label="전환" cur={cur.conv} cmp={cmp.conv} goodUp sub={cur.cpa == null ? "" : `1건당 ${won(cur.cpa)}원`} /> : <Kpi label="노출" cur={cur.imp} cmp={cmp.imp} goodUp />}
      </div>
    </div>
  );
}

function Kpi({ label, cur, cmp, unit = "", goodUp, sub = "" }: { label: string; cur: number | null; cmp: number | null; unit?: string; goodUp: boolean; sub?: string }) {
  const d = pctDelta(cur, cmp);
  return (
    <div className="rounded-xl bg-background px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-bold leading-tight tabular-nums">
        {won(cur)}
        <span className="ml-0.5 text-xs font-normal text-muted">{cur == null ? "" : unit}</span>
      </p>
      <p className="mt-0.5 text-xs tabular-nums">
        <span className={`font-bold ${deltaClass(d, goodUp)}`}>{deltaTxt(d)}</span>
        <span className="text-muted"> 비교 기간{sub && ` · ${sub}`}</span>
      </p>
    </div>
  );
}
