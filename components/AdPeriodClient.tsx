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
const short = (n: string) => n.replace(/^제이드앤워터\s*/, "").replace(/^정다미\s*/, "정다미 ");
const man = (n: number | null) => (n == null ? "-" : Math.abs(n) >= 10000 ? `${Math.round(n / 10000).toLocaleString("ko-KR")}만` : won(n));

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
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKey(k)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${key === k ? "bg-brand text-white" : "border border-border bg-card text-foreground"}`}
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
          {res.total ? (
            <>
              <SummaryStrip cur={res.total.cur} cmp={res.total.cmp} />
              <StoreTable stores={res.stores} />
              <CompareLines stores={res.stores} />
            </>
          ) : (
            res.stores.map((s) => (
              <div key={s.storeId} className="rounded-2xl border border-border bg-card p-4">
                <KpiGrid cur={s.cur} cmp={s.cmp} />
                <StoreNote s={s} />
              </div>
            ))
          )}
        </>
      )}
    </section>
  );
}

// 전 매장 합계: 한 줄 4칸. 자세한 건 매장 표에서.
function SummaryStrip({ cur, cmp }: { cur: PeriodAgg; cmp: PeriodAgg }) {
  const tiles: { label: string; v: number | null; p: number | null; goodUp: boolean; fmt: (n: number | null) => string }[] = [
    { label: "광고비", v: cur.cost, p: cmp.cost, goodUp: false, fmt: man },
    { label: "매출", v: cur.sales, p: cmp.sales, goodUp: true, fmt: man },
    { label: "광고비 대비", v: cur.roas, p: cmp.roas, goodUp: true, fmt: (n) => (n == null ? "-" : won(n) + "%") },
    { label: "클릭", v: cur.clk, p: cmp.clk, goodUp: true, fmt: (n) => (n == null ? "-" : won(n)) },
  ];
  return (
    <div className="rounded-2xl border border-brand bg-card p-3">
      <p className="mb-1.5 text-xs font-bold">전 매장 합계</p>
      <div className="grid grid-cols-4 gap-1.5">
        {tiles.map((t) => {
          const d = pctDelta(t.v, t.p);
          return (
            <div key={t.label} className="rounded-xl bg-background px-2 py-2 text-center">
              <p className="text-[10px] text-muted">{t.label}</p>
              <p className="text-sm font-bold leading-tight tabular-nums">{t.fmt(t.v)}</p>
              <p className={`text-[10px] font-semibold tabular-nums ${deltaClass(d, t.goodUp)}`}>{deltaTxt(d)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 매장별 한 줄 표. 누르면 그 매장의 6칸 상세가 펼쳐진다.
function StoreTable({ stores }: { stores: PeriodStore[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-b border-border px-3 py-2 text-[10px] text-muted">
        <span>매장</span>
        <span className="text-right">광고비</span>
        <span className="text-right">매출</span>
        <span className="text-right">광고비 대비</span>
      </div>
      {stores.map((s) => {
        const isOpen = open === s.storeId;
        const dRoas = pctDelta(s.cur.roas, s.cmp.roas);
        return (
          <div key={s.storeId} className="border-b border-border last:border-b-0">
            <button type="button" onClick={() => setOpen(isOpen ? null : s.storeId)} className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 px-3 py-2.5 text-left text-xs tabular-nums">
              <span className="flex items-center gap-1 font-semibold">
                <span className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                {short(s.name)}
                {!s.adConnected && <span className="ml-1 rounded bg-gray-100 px-1 text-[9px] font-normal text-gray-500">광고 미연결</span>}
              </span>
              <span className="text-right">{man(s.cur.cost)}</span>
              <span className="text-right">{man(s.cur.sales)}</span>
              <span className="text-right">
                {s.cur.roas == null ? "-" : won(s.cur.roas) + "%"}
                <span className={`ml-1 text-[10px] ${deltaClass(dRoas, true)}`}>{dRoas == null ? "" : deltaTxt(dRoas)}</span>
              </span>
            </button>
            {isOpen && (
              <div className="bg-background/60 px-3 pb-3 pt-1">
                <KpiGrid cur={s.cur} cmp={s.cmp} />
                <StoreNote s={s} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StoreNote({ s }: { s: PeriodStore }) {
  const note = [!s.adConnected && "광고 미연결", !s.tossLinked && "매출은 마감입력 기준", s.error && `일부 못 읽음: ${s.error}`].filter(Boolean).join(" · ");
  return note ? <p className="mt-1.5 text-[11px] text-muted">{note}</p> : null;
}

function KpiGrid({ cur, cmp }: { cur: PeriodAgg; cmp: PeriodAgg }) {
  const convTracked = cur.conv > 0 || cmp.conv > 0;
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <Kpi label="광고비" cur={cur.cost} cmp={cmp.cost} unit="원" goodUp={false} />
      <Kpi label="매출" cur={cur.sales} cmp={cmp.sales} unit="원" goodUp sub={cur.sales != null && cur.days > 1 ? `${cur.salesDays}일` : ""} />
      <Kpi label="광고비 대비 매출" cur={cur.roas} cmp={cmp.roas} unit="%" goodUp sub={cur.adShare == null ? "" : `매출의 ${cur.adShare.toFixed(1)}%`} />
      <Kpi label="클릭" cur={cur.clk} cmp={cmp.clk} goodUp sub={cur.ctr == null ? "" : `클릭률 ${cur.ctr.toFixed(2)}%`} />
      <Kpi label="클릭 한 번 값" cur={cur.cpc} cmp={cmp.cpc} unit="원" goodUp={false} />
      {convTracked ? <Kpi label="전환" cur={cur.conv} cmp={cmp.conv} goodUp sub={cur.cpa == null ? "" : `1건당 ${won(cur.cpa)}원`} /> : <Kpi label="노출" cur={cur.imp} cmp={cmp.imp} goodUp />}
    </div>
  );
}

function Kpi({ label, cur, cmp, unit = "", goodUp, sub = "" }: { label: string; cur: number | null; cmp: number | null; unit?: string; goodUp: boolean; sub?: string }) {
  const d = pctDelta(cur, cmp);
  return (
    <div className="rounded-xl bg-card px-2.5 py-2">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="text-sm font-bold leading-tight tabular-nums">
        {won(cur)}
        <span className="ml-0.5 text-[10px] font-normal text-muted">{cur == null ? "" : unit}</span>
      </p>
      <p className="text-[10px] tabular-nums">
        <span className={`font-semibold ${deltaClass(d, goodUp)}`}>{deltaTxt(d)}</span>
        {sub && <span className="text-muted"> · {sub}</span>}
      </p>
    </div>
  );
}

// 매장 간 비교: 격차가 큰 지표만 한 줄씩. 기본 2줄, 나머지는 펼쳐서.
function CompareLines({ stores }: { stores: PeriodStore[] }) {
  const [more, setMore] = useState(false);
  const on = stores.filter((s) => s.adConnected && s.cur.cost > 0);
  if (on.length < 2) return null;
  const pick = (f: (s: PeriodStore) => number | null) => {
    const list = on.filter((s) => f(s) != null);
    if (list.length < 2) return null;
    const hi = list.reduce((a, b) => (f(b)! > f(a)! ? b : a));
    const lo = list.reduce((a, b) => (f(b)! < f(a)! ? b : a));
    return hi === lo ? null : { hi, lo, hv: f(hi)!, lv: f(lo)! };
  };
  const lines: { text: string; tip: string }[] = [];
  const roas = pick((s) => s.cur.roas);
  if (roas) lines.push({ text: `광고 효율 최고 ${short(roas.hi.name)} ${won(roas.hv)}% · 최저 ${short(roas.lo.name)} ${won(roas.lv)}%`, tip: `${short(roas.hi.name)} 캠페인 구성을 ${short(roas.lo.name)}에 적용해 볼 만해요.` });
  const share = pick((s) => s.cur.adShare);
  if (share && share.hv >= share.lv * 1.3) lines.push({ text: `매출 대비 광고비 ${short(share.hi.name)} ${share.hv.toFixed(2)}% vs ${short(share.lo.name)} ${share.lv.toFixed(2)}%`, tip: `${short(share.hi.name)}은 광고비를 더 쓰고 있어요. 매출이 그만큼 따라오는지 확인하세요.` });
  const ctr = pick((s) => s.cur.ctr);
  if (ctr && ctr.hv >= ctr.lv * 1.3) lines.push({ text: `클릭률 ${short(ctr.hi.name)} ${ctr.hv.toFixed(2)}% vs ${short(ctr.lo.name)} ${ctr.lv.toFixed(2)}%`, tip: `${short(ctr.lo.name)}의 광고 문구·키워드를 ${short(ctr.hi.name)} 것과 비교해 보세요.` });
  const cpc = pick((s) => s.cur.cpc);
  if (cpc && cpc.hv >= cpc.lv * 1.3) lines.push({ text: `클릭 한 번 값 ${short(cpc.hi.name)} ${won(cpc.hv)}원 vs ${short(cpc.lo.name)} ${won(cpc.lv)}원`, tip: `${short(cpc.hi.name)}은 입찰가가 높거나 경쟁 키워드가 많아요. 입찰가를 낮춰 볼 만해요.` });
  if (!lines.length) return null;
  const shown = more ? lines : lines.slice(0, 2);
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="mb-1.5 text-xs font-bold">매장 간 비교</p>
      <ul className="flex flex-col gap-1.5">
        {shown.map((l, i) => (
          <li key={i} className="text-xs">
            <p className="font-semibold leading-snug">{l.text}</p>
            <p className="text-[11px] leading-snug text-muted">{l.tip}</p>
          </li>
        ))}
      </ul>
      {lines.length > 2 && (
        <button type="button" onClick={() => setMore(!more)} className="mt-1.5 text-[11px] text-brand underline">
          {more ? "접기" : `${lines.length - 2}개 더 보기`}
        </button>
      )}
    </div>
  );
}
