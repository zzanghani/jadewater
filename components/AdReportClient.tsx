"use client";

import { useEffect, useState, useTransition } from "react";
import { buildAdReportAction } from "@/app/(app)/ad-report/actions";
import { pctDelta, reportText, won, type AdStoreReport, type AdWeeklyReport } from "@/lib/adReport";

const SEV_LABEL = { bad: "조치 필요", warn: "점검", good: "기회" } as const;
const SEV_CLASS = {
  bad: "bg-red-50 text-red-600",
  warn: "bg-amber-50 text-amber-700",
  good: "bg-green-50 text-green-700",
} as const;

function deltaTxt(d: number | null) {
  return d == null ? "-" : (d > 0 ? "+" : "") + d.toFixed(0) + "%";
}
// 좋은 방향이면 초록, 나쁜 방향이면 빨강 (goodUp: 올라가는 게 좋은 지표인지)
function deltaClass(d: number | null, goodUp: boolean) {
  if (d == null || Math.abs(d) < 0.5) return "text-muted";
  return (d > 0) === goodUp ? "text-green-700" : "text-red-600";
}

export default function AdReportClient({ initial }: { initial: AdWeeklyReport | null }) {
  const [report, setReport] = useState<AdWeeklyReport | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [copied, setCopied] = useState(false);

  function build(refresh: boolean) {
    setError(null);
    startLoad(async () => {
      const r = await buildAdReportAction(refresh);
      if (r.ok) setReport(r.report);
      else setError(r.error);
    });
  }

  // 저장본이 없으면 들어오자마자 만든다 (전 매장이면 30초쯤 걸린다).
  // 상태 변경은 서버 응답을 받은 뒤(비동기)에만 한다.
  useEffect(() => {
    if (initial) return;
    startLoad(async () => {
      const r = await buildAdReportAction(false);
      if (r.ok) setReport(r.report);
      else setError(r.error);
    });
  }, [initial]);

  async function copyText() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(reportText(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => build(true)}
          disabled={loading}
          className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading ? "만드는 중..." : "최신 데이터로 다시 만들기"}
        </button>
        <button
          type="button"
          onClick={copyText}
          disabled={!report || loading}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {copied ? "복사됨 ✓" : "카톡용 텍스트 복사"}
        </button>
        {report && !loading && (
          <span className="ml-auto text-[11px] text-muted">
            {new Date(report.generatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 생성
          </span>
        )}
      </div>

      {loading && !report && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">
          <p className="font-semibold text-foreground">주간 리포트를 만드는 중이에요</p>
          <p className="mt-1 text-xs">매장마다 키워드까지 조회해서 30초 정도 걸릴 수 있어요.</p>
        </div>
      )}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {report?.stores.map((s) => <StoreCard key={s.storeId} s={s} rep={report} />)}

      {report && (
        <p className="text-center text-[11px] text-muted">
          지난주(월~일) 기준이에요. 같은 리포트를 6시간 동안 보여주고, 매주 월요일 아침 알림으로도 보내요.
        </p>
      )}
    </div>
  );
}

function Kpi({ label, cur, prev, unit = "", goodUp, fmt = won }: { label: string; cur: number | null; prev: number | null; unit?: string; goodUp: boolean; fmt?: (n: number | null) => string }) {
  const d = pctDelta(cur, prev);
  return (
    <div className="rounded-xl bg-background px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-base font-bold tabular-nums">
        {fmt(cur)}
        <span className="text-xs font-normal text-muted">{cur == null ? "" : unit}</span>
      </p>
      <p className={`text-[11px] font-semibold tabular-nums ${deltaClass(d, goodUp)}`}>
        {deltaTxt(d)} <span className="font-normal text-muted">전주</span>
      </p>
    </div>
  );
}

function StoreCard({ s, rep }: { s: AdStoreReport; rep: AdWeeklyReport }) {
  if (s.error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-card p-4">
        <h2 className="text-sm font-bold">{s.name}</h2>
        <p className="mt-1 text-xs text-red-600">불러오지 못했어요: {s.error}</p>
      </section>
    );
  }
  const month = Number(rep.mtd[1].slice(5, 7));
  const pacePct = s.budget ? Math.min(100, (s.mtd.cost / s.budget) * 100) : null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">{s.name}</h2>
        <span className="text-[11px] text-muted tabular-nums">
          비즈머니 {won(s.biz)}원{s.bizDays != null && ` · 약 ${Math.floor(s.bizDays)}일분`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Kpi label="광고비" cur={s.week.cost} prev={s.prev.cost} unit="원" goodUp={false} />
        <Kpi label="클릭" cur={s.week.clk} prev={s.prev.clk} goodUp />
        {s.convTracked ? (
          <>
            <Kpi label="전환" cur={s.week.conv} prev={s.prev.conv} goodUp />
            <Kpi label="전환당 비용" cur={s.week.cpa} prev={s.prev.cpa} unit="원" goodUp={false} />
          </>
        ) : (
          <Kpi label="클릭당 비용" cur={s.week.cpc} prev={s.prev.cpc} unit="원" goodUp={false} />
        )}
        {s.sales && <Kpi label="광고비 대비 매출" cur={s.sales.roas} prev={s.sales.roasPrev} unit="%" goodUp />}
      </div>

      {s.sales && (
        <p className="text-xs text-muted">
          매출 {won(s.sales.week.sum)}원({s.sales.week.days}일 입력) 중 광고비 비중 {s.sales.adShare == null ? "-" : s.sales.adShare.toFixed(1) + "%"}
          {s.sales.norm != null && (
            <>
              {" · "}평소 대비{" "}
              <span className={`font-semibold ${s.sales.norm < 0.85 ? "text-red-600" : s.sales.norm > 1.05 ? "text-green-700" : ""}`}>
                {(s.sales.norm >= 1 ? "+" : "") + ((s.sales.norm - 1) * 100).toFixed(1)}%
              </span>
            </>
          )}
        </p>
      )}

      <div className="rounded-xl bg-background px-3 py-2 text-xs">
        <p className="text-muted">{month}월 광고비 ({rep.monthElapsed}/{rep.monthDays}일 경과)</p>
        <p className="mt-0.5 font-semibold tabular-nums">
          {won(s.mtd.cost)}원 → 월말 예상 {won(s.projected)}원{s.budget && ` / 예산 ${won(s.budget)}원`}
        </p>
        {pacePct != null && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
            <div className={`h-full rounded-full ${s.projected && s.budget && s.projected > s.budget * 1.1 ? "bg-red-500" : "bg-brand"}`} style={{ width: `${pacePct}%` }} />
          </div>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-bold">이번 주 할 일</p>
        {s.actions.length === 0 ? (
          <p className="text-xs text-green-700">급한 조치가 없어요.</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {s.actions.map((a, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed">
                <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${SEV_CLASS[a.sev]}`}>{SEV_LABEL[a.sev]}</span>
                <span>{a.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
