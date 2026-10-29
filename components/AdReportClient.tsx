"use client";

import { useEffect, useState, useTransition } from "react";
import { buildAdReportAction } from "@/app/(app)/ad-report/actions";
import { pctDelta, won, type AdStoreReport, type AdWeeklyReport } from "@/lib/adReport";

const SEV_LABEL = { bad: "조치", warn: "점검", good: "기회" } as const;
const SEV_CLASS = {
  bad: "bg-red-50 text-red-600",
  warn: "bg-amber-50 text-amber-700",
  good: "bg-green-50 text-green-700",
} as const;

// 들어올 때 저장본이 이보다 오래됐으면 자동으로 새로 만든다 (버튼 없이).
const STALE_MS = 30 * 60e3;

function deltaTxt(d: number | null) {
  if (d == null) return "-";
  const arrow = d > 0.5 ? "▲" : d < -0.5 ? "▼" : "";
  return `${arrow}${Math.abs(d).toFixed(0)}%`;
}
function deltaClass(d: number | null, goodUp: boolean) {
  if (d == null || Math.abs(d) < 0.5) return "text-muted";
  return (d > 0) === goodUp ? "text-green-700" : "text-red-600";
}
function ago(ts: number) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60e3));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
}
const short = (n: string) => n.replace(/^제이드앤워터\s*/, "").replace(/^정다미\s*/, "정다미 ");

export default function AdReportClient({ initial }: { initial: AdWeeklyReport | null }) {
  const [report, setReport] = useState<AdWeeklyReport | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  // 저장본은 바로 보여주고, 오래됐으면(또는 없으면) 뒤에서 최신 데이터로 다시 만든다.
  useEffect(() => {
    const stale = !initial || Date.now() - initial.generatedAt > STALE_MS;
    if (!stale) return;
    startLoad(async () => {
      const r = await buildAdReportAction(!!initial);
      if (r.ok) setReport(r.report);
      else setError(r.error);
    });
  }, [initial]);

  const single = (report?.stores.length ?? 0) === 1;
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-xs text-muted">
        {loading ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            {report ? "최신 데이터로 갱신하는 중…" : "리포트를 만드는 중… (매장마다 키워드까지 읽어서 30초쯤 걸려요)"}
          </>
        ) : report ? (
          <>
            지난주 {report.week[0].slice(5).replace("-", "/")}~{report.week[1].slice(5).replace("-", "/")} 기준 · {ago(report.generatedAt)} 갱신 · 매주 월요일 아침 알림
          </>
        ) : null}
      </p>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {report?.stores.map((s) => <StoreCard key={s.storeId} s={s} rep={report} defaultOpen={single} />)}
    </div>
  );
}

function Kpi({ label, cur, prev, unit = "", goodUp, fmt = won }: { label: string; cur: number | null; prev: number | null; unit?: string; goodUp: boolean; fmt?: (n: number | null) => string }) {
  const d = pctDelta(cur, prev);
  return (
    <div className="rounded-xl bg-card px-2.5 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-sm font-bold leading-tight tabular-nums">
        {fmt(cur)}
        <span className="ml-0.5 text-[11px] font-normal text-muted">{cur == null ? "" : unit}</span>
      </p>
      <p className={`text-[11px] font-semibold tabular-nums ${deltaClass(d, goodUp)}`}>
        {deltaTxt(d)} <span className="font-normal text-muted">전주</span>
      </p>
    </div>
  );
}

// 매장 카드: 이름·비즈머니·할 일만 먼저. 숫자(지난주 성과·월 예산)는 '성과 보기'로 펼친다.
function StoreCard({ s, rep, defaultOpen }: { s: AdStoreReport; rep: AdWeeklyReport; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (s.error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-card p-3">
        <h2 className="text-sm font-bold">{short(s.name)}</h2>
        <p className="mt-1 text-xs text-red-600">불러오지 못했어요: {s.error}</p>
      </section>
    );
  }
  const month = Number(rep.mtd[1].slice(5, 7));
  const pacePct = s.budget ? Math.min(100, (s.mtd.cost / s.budget) * 100) : null;
  const overBudget = !!(s.projected && s.budget && s.projected > s.budget * 1.1);
  const bizLow = s.bizDays != null && s.bizDays < 7;
  const bad = s.actions.filter((a) => a.sev === "bad").length;
  return (
    <section className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">
          {short(s.name)}
          {bad > 0 && <span className="ml-1.5 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-red-600">조치 {bad}</span>}
        </h2>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${bizLow ? "bg-red-50 text-red-600" : "bg-background text-muted"}`}>
          비즈머니 {won(s.biz)}{s.bizDays != null && ` · ${Math.floor(s.bizDays)}일분`}
        </span>
      </div>

      {s.actions.length === 0 ? (
        <p className="mt-2 text-xs text-green-700">급한 조치가 없어요.</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-1">
          {s.actions.map((a, i) => (
            <li key={i} className="flex gap-1.5 text-xs leading-snug">
              <span className={`mt-0.5 h-fit shrink-0 rounded-md px-1 py-0.5 text-[11px] font-bold ${SEV_CLASS[a.sev]}`}>{SEV_LABEL[a.sev]}</span>
              <span>{a.text}</span>
            </li>
          ))}
        </ol>
      )}

      <button type="button" onClick={() => setOpen(!open)} className="mt-2 text-[11px] font-semibold text-brand">
        {open ? "성과 접기 ▴" : "지난주 성과 보기 ▾"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-xl bg-background p-2">
          <div className="grid grid-cols-3 gap-1.5">
            <Kpi label="광고비" cur={s.week.cost} prev={s.prev.cost} unit="원" goodUp={false} />
            <Kpi label="클릭" cur={s.week.clk} prev={s.prev.clk} goodUp />
            {s.convTracked ? <Kpi label="전환당 비용" cur={s.week.cpa} prev={s.prev.cpa} unit="원" goodUp={false} /> : <Kpi label="클릭 한 번 값" cur={s.week.cpc} prev={s.prev.cpc} unit="원" goodUp={false} />}
            {s.sales && <Kpi label="광고비 대비 매출" cur={s.sales.roas} prev={s.sales.roasPrev} unit="%" goodUp />}
            {s.sales && <Kpi label="지난주 매출" cur={s.sales.week.sum} prev={null} unit="원" goodUp fmt={(n) => won(n)} />}
            {s.sales && (
              <div className="rounded-xl bg-card px-2.5 py-2">
                <p className="text-[11px] text-muted">광고비 비중 · 평소 대비</p>
                <p className="text-sm font-bold tabular-nums">{s.sales.adShare == null ? "-" : s.sales.adShare.toFixed(1) + "%"}</p>
                <p className={`text-[11px] font-semibold tabular-nums ${s.sales.norm == null ? "text-muted" : s.sales.norm < 0.85 ? "text-red-600" : s.sales.norm > 1.05 ? "text-green-700" : "text-muted"}`}>
                  {s.sales.norm == null ? "-" : (s.sales.norm >= 1 ? "+" : "") + ((s.sales.norm - 1) * 100).toFixed(1) + "%"}
                </p>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-card px-2.5 py-2 text-xs">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] text-muted">
                {month}월 광고비 · {rep.monthElapsed}/{rep.monthDays}일
              </p>
              {s.budget ? <p className={`text-[11px] font-bold ${overBudget ? "text-red-600" : "text-muted"}`}>{overBudget ? "예산 초과 예상" : "예산 안"}</p> : null}
            </div>
            <p className="mt-0.5 font-semibold tabular-nums">
              {won(s.mtd.cost)}원 <span className="font-normal text-muted">→ 월말</span> {won(s.projected)}원
              {s.budget && (
                <>
                  {" "}
                  <span className="font-normal text-muted">/ 예산</span> {won(s.budget)}원
                </>
              )}
            </p>
            {pacePct != null && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                <div className={`h-full rounded-full ${overBudget ? "bg-red-500" : "bg-brand"}`} style={{ width: `${pacePct}%` }} />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
