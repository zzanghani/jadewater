"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { addSpecialDay, generateStrategyMemo, loadAdInsight, removeSpecialDay, saveCostRate, type InsightResult } from "@/app/(app)/ad-report/insight/actions";
import { won, type AdInsight, type PeriodStat } from "@/lib/adInsight";
import { pctDelta } from "@/lib/adReport";
import AdInsightChart from "@/components/AdInsightChart";
import { parseAdStrategyMemo } from "@/lib/adStrategyMemo";

const SEV = {
  bad: "bg-red-50 text-red-600",
  warn: "bg-amber-50 text-amber-700",
  good: "bg-green-50 text-green-700",
  info: "bg-blue-50 text-blue-700",
} as const;
const SEV_LABEL = { bad: "조치", warn: "점검", good: "좋음", info: "참고" } as const;

function d(c: number | null, p: number | null) {
  const v = pctDelta(c, p);
  return v == null ? "" : (v > 0 ? "+" : "") + v.toFixed(0) + "%";
}
function dCls(c: number | null, p: number | null, goodUp: boolean) {
  const v = pctDelta(c, p);
  if (v == null || Math.abs(v) < 0.5) return "text-muted";
  return (v > 0) === goodUp ? "text-green-700" : "text-red-600";
}

export default function AdInsightClient({ storeId }: { storeId: string }) {
  const [res, setRes] = useState<InsightResult | null>(null);
  const [loading, start] = useTransition();
  const [memoLoading, startMemo] = useTransition();
  const [memoError, setMemoError] = useState<string | null>(null);

  useEffect(() => {
    start(async () => setRes(await loadAdInsight(storeId)));
  }, [storeId]);

  function sync() {
    start(async () => setRes(await loadAdInsight(storeId, { sync: true })));
  }
  function makeMemo() {
    setMemoError(null);
    startMemo(async () => {
      const r = await generateStrategyMemo(storeId);
      if (!r.ok) setMemoError(r.error);
      else setRes((prev) => (prev && prev.ok ? { ...prev, memo: r.memo, memoAt: new Date().toISOString() } : prev));
    });
  }

  if (!res) return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">{loading ? "불러오는 중..." : ""}</p>;
  if (!res.ok) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{res.error}</p>;
  const x = res.insight;
  const needSync = x.week.salesDays === 0 && x.week.cost === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={sync} disabled={loading} className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
          {loading ? "동기화 중..." : "최근 8주 동기화"}
        </button>
        <Link href="/ad-report/manage" className="rounded-xl border border-brand px-3 py-2 text-xs font-semibold text-brand">
          광고 관리
        </Link>
        {(res.synced.ad != null || res.synced.toss != null) && (
          <span className="text-[11px] text-muted">
            {res.synced.ad != null && `광고 ${res.synced.ad}일`}
            {res.synced.ad != null && res.synced.toss != null && " · "}
            {res.synced.toss != null && `토스 ${res.synced.toss}일`} 갱신
          </span>
        )}
      </div>
      {needSync && <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">아직 쌓인 데이터가 없어요. &lsquo;최근 8주 동기화&rsquo;를 한 번 눌러 주세요 (30초쯤 걸려요).</p>}

      {/* 오늘 실시간 */}
      <section className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-4 text-white shadow-lg shadow-brand/25">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-white/85">오늘 실시간 · {x.today.date.slice(5).replace("-", "/")}</p>
          {x.today.lastPayAt && <p className="text-[11px] text-white/70">마지막 결제 {x.today.lastPayAt}</p>}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-white/70">매출</p>
            <p className="text-lg font-bold tabular-nums">{x.today.sales == null ? "-" : won(x.today.sales)}<span className="text-xs font-normal">원</span></p>
            {x.today.orders != null && <p className="text-white/70">{x.today.orders}건</p>}
          </div>
          <div>
            <p className="text-white/70">광고비</p>
            <p className="text-lg font-bold tabular-nums">{won(x.today.cost)}<span className="text-xs font-normal">원</span></p>
            <p className="text-white/70">클릭 {x.today.clk}</p>
          </div>
          <div>
            <p className="text-white/70">광고비 대비 매출</p>
            <p className="text-lg font-bold tabular-nums">{x.today.roas == null ? "-" : won(x.today.roas) + "%"}</p>
            <p className="text-white/70">광고비 1원당 {x.today.roas == null ? "-" : (x.today.roas / 100).toFixed(0)}원</p>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-white/60">오늘 광고비는 어젯밤 동기화 이후 값이라 조금 늦을 수 있어요.</p>
      </section>

      {/* 7일 / 28일 */}
      <PeriodCard title="최근 7일" cur={x.week} prev={x.weekPrev} norm={x.weather.adjNorm ?? x.salesNorm} convTracked={x.convTracked} note={x.weather.hasWeather ? `비 ${x.weather.rainyDays7}일${x.weather.excluded7 ? ` · 비교 제외 ${x.weather.excluded7}일` : ""}` : ""} />
      <PeriodCard title="최근 28일" cur={x.month} prev={x.monthPrev} norm={null} convTracked={x.convTracked} />

      {/* 추이 */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">최근 4주 매출 vs 광고비</h2>
        <AdInsightChart rows={x.series} />
        {x.weather.hasWeather && <p className="mt-1 text-[10px] text-muted">연한 막대 = 비 온 날(1mm↑) · 빗금 없는 회색 = 공휴일·특이일. 평소 대비 계산에서 큰비·공휴일·특이일은 뺐어요.</p>}
      </section>

      {/* 손익분기 · 날씨 보정 */}
      <BreakevenCard storeId={storeId} x={x} onSaved={() => start(async () => setRes(await loadAdInsight(storeId)))} />

      {/* 특이일 */}
      <SpecialDays storeId={storeId} days={x.specialDays} onChanged={() => start(async () => setRes(await loadAdInsight(storeId)))} />

      {/* 요일별 */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">요일별 효율 (최근 28일)</h2>
        <div className="grid grid-cols-7 gap-1 text-center">
          {x.weekday.map((w) => {
            const best = Math.max(...x.weekday.map((v) => v.roas ?? 0));
            const h = w.roas && best ? Math.max(8, (w.roas / best) * 56) : 4;
            return (
              <div key={w.label} className="flex flex-col items-center gap-1">
                <div className="flex h-14 items-end">
                  <div className={`w-5 rounded-t ${w.roas === best && best > 0 ? "bg-brand" : "bg-brand/40"}`} style={{ height: h }} />
                </div>
                <p className="text-[11px] font-semibold">{w.label}</p>
                <p className="text-[10px] tabular-nums text-muted">{w.roas == null ? "-" : won(w.roas) + "%"}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-muted">막대 = 광고비 대비 매출. 높을수록 그 요일 광고가 효율적이에요.</p>
      </section>

      {/* 진단 */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">자동 진단</h2>
        <ul className="flex flex-col gap-1.5">
          {x.findings.map((f, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed">
              <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${SEV[f.sev]}`}>{SEV_LABEL[f.sev]}</span>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* AI 전략 */}
      <section className="rounded-2xl border border-brand bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold">AI 전략 메모</h2>
          <button type="button" onClick={makeMemo} disabled={memoLoading || needSync} className="rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {memoLoading ? "쓰는 중..." : res.memo ? "다시 생성" : "전략 생성"}
          </button>
        </div>
        {memoError && <p className="mb-2 text-xs text-red-600">{memoError}</p>}
        {res.memo ? (
          <>
            <StrategyMemo raw={res.memo} />
            {res.memoAt && <p className="mt-2 text-[10px] text-muted">{new Date(res.memoAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 생성</p>}
          </>
        ) : (
          <p className="text-xs text-muted">위 숫자를 읽고 &lsquo;진단 → 이번 주 전략 3개 → 예산 제안&rsquo;을 써줘요.</p>
        )}
      </section>
    </div>
  );
}

function PeriodCard({ title, cur, prev, norm, convTracked, note = "" }: { title: string; cur: PeriodStat; prev: PeriodStat; norm: number | null; convTracked: boolean; note?: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold">
          {title}
          {note && <span className="ml-2 text-[10px] font-normal text-muted">{note}</span>}
        </h2>
        {norm != null && (
          <span className={`text-[11px] font-semibold ${norm < 0.85 ? "text-red-600" : norm > 1.05 ? "text-green-700" : "text-muted"}`}>
            매출 평소 대비 {(norm >= 1 ? "+" : "") + ((norm - 1) * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="매출" v={cur.sales} p={prev.sales} unit="원" goodUp sub={`${cur.salesDays}일`} />
        <Kpi label="광고비" v={cur.cost} p={prev.cost} unit="원" goodUp={false} sub={cur.adShare == null ? "" : `매출의 ${cur.adShare.toFixed(1)}%`} />
        <Kpi label="광고비 대비 매출" v={cur.roas} p={prev.roas} unit="%" goodUp sub={cur.roas == null ? "" : `1원당 ${(cur.roas / 100).toFixed(0)}원`} />
        {convTracked ? <Kpi label="전환당 비용" v={cur.cpa} p={prev.cpa} unit="원" goodUp={false} sub={`전환 ${cur.conv}`} /> : <Kpi label="클릭당 비용" v={cur.cpc} p={prev.cpc} unit="원" goodUp={false} sub={`클릭 ${cur.clk}`} />}
      </div>
    </section>
  );
}

function Kpi({ label, v, p, unit, goodUp, sub }: { label: string; v: number | null; p: number | null; unit: string; goodUp: boolean; sub: string }) {
  return (
    <div className="rounded-xl bg-background px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-base font-bold tabular-nums">
        {won(v)}
        <span className="text-xs font-normal text-muted">{v == null ? "" : unit}</span>
      </p>
      <p className="text-[11px] tabular-nums">
        <span className={`font-semibold ${dCls(v, p, goodUp)}`}>{d(v, p) || "-"}</span>
        <span className="text-muted"> 직전 기간 {sub && `· ${sub}`}</span>
      </p>
    </div>
  );
}

const VERDICT = {
  유지: "bg-slate-100 text-slate-700",
  증액: "bg-green-50 text-green-700",
  감액: "bg-amber-50 text-amber-700",
} as const;

// AI 메모를 카드로 나눠 보여준다. 예전에 저장된 긴 텍스트 메모는 그대로 텍스트로.
function StrategyMemo({ raw }: { raw: string }) {
  const m = parseAdStrategyMemo(raw);
  if (!m) return <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{raw.replace(/^#+\s*/gm, "").replace(/\*\*/g, "")}</pre>;
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-brand/10 px-3 py-2 text-sm font-semibold leading-snug">{m.headline}</p>

      {(m.good.length > 0 || m.issues.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {m.good.length > 0 && (
            <div className="rounded-xl bg-green-50 p-3">
              <p className="mb-1 text-[11px] font-bold text-green-700">좋은 점</p>
              <ul className="space-y-1 text-xs leading-snug text-green-900">
                {m.good.map((s, i) => (
                  <li key={i} className="flex gap-1.5"><span>✓</span><span>{s}</span></li>
                ))}
              </ul>
            </div>
          )}
          {m.issues.length > 0 && (
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="mb-1 text-[11px] font-bold text-amber-700">문제</p>
              <ul className="space-y-1 text-xs leading-snug text-amber-900">
                {m.issues.map((s, i) => (
                  <li key={i} className="flex gap-1.5"><span>!</span><span>{s}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {m.actions.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-muted">이번 주 할 일</p>
          <ol className="space-y-2">
            {m.actions.map((a, i) => (
              <li key={i} className="rounded-xl border border-border p-3">
                <p className="text-sm font-semibold leading-snug">
                  <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">{i + 1}</span>
                  {a.title}
                </p>
                {a.amount && <p className="mt-1 text-xs leading-snug">{a.amount}</p>}
                {a.why && <p className="mt-0.5 text-[11px] leading-snug text-muted">근거 · {a.why}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold text-muted">예산 제안</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${VERDICT[m.budget.verdict]}`}>{m.budget.verdict}</span>
        </div>
        {m.budget.range && <p className="mt-1 text-sm font-semibold">{m.budget.range}</p>}
        {m.budget.why && <p className="mt-0.5 text-[11px] leading-snug text-muted">{m.budget.why}</p>}
      </div>
    </div>
  );
}

// 광고 손익분기: 원가율을 넣으면 "광고비 1만원 늘릴 때 매출이 얼마나 따라와야 본전인지"가 나온다.
function BreakevenCard({ storeId, x, onSaved }: { storeId: string; x: AdInsight; onSaved: () => void }) {
  const [rate, setRate] = useState(String(Math.round(x.breakeven.costRate * 100)));
  const [saving, startSave] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const b = x.breakeven;
  const w = x.week;
  const over = w.roas != null && w.cost > 0 ? w.roas >= b.minRoas : null;
  function save() {
    setErr(null);
    startSave(async () => {
      const r = await saveCostRate(storeId, Number(rate));
      if (!r.ok) setErr(r.error);
      else onSaved();
    });
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold">광고 손익분기</h2>
        <label className="flex items-center gap-1 text-[11px] text-muted">
          원가율
          <input type="number" inputMode="numeric" min={0} max={94} value={rate} onChange={(e) => setRate(e.target.value)} className="w-14 rounded-lg border border-border bg-background px-2 py-1 text-right text-xs text-foreground" />
          %
          <button type="button" onClick={save} disabled={saving || Number(rate) === Math.round(b.costRate * 100)} className="rounded-lg bg-brand px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40">
            {saving ? "저장 중" : "저장"}
          </button>
        </label>
      </div>
      {err && <p className="mb-2 text-xs text-red-600">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-background px-3 py-2">
          <p className="text-[11px] text-muted">본전이 되는 광고비 대비 매출</p>
          <p className="text-base font-bold tabular-nums">{won(b.minRoas)}<span className="text-xs font-normal text-muted">%</span></p>
          <p className={`text-[11px] font-semibold ${over == null ? "text-muted" : over ? "text-green-700" : "text-red-600"}`}>
            {over == null ? "최근 7일 자료 없음" : `최근 7일 ${won(w.roas)}% · ${over ? "넘김" : "미달"}`}
          </p>
        </div>
        <div className="rounded-xl bg-background px-3 py-2">
          <p className="text-[11px] text-muted">광고비 1만원 늘리면 필요한 매출</p>
          <p className="text-base font-bold tabular-nums">{won(b.neededPer10k)}<span className="text-xs font-normal text-muted">원</span></p>
          <p className="text-[11px] text-muted">{b.weekProfit == null ? "" : `최근 7일 광고 뒤 남은 이익 ${won(b.weekProfit)}원`}</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted">원가율 = 재료비 등 매출에 비례해 나가는 비용 비율. 매출 1만원 중 {Math.round(b.costRate * 100)}%가 원가면 광고비 1만원은 매출 {won(b.neededPer10k)}원이 돼야 본전이에요.</p>
    </section>
  );
}

// 특이일: 행사·단체·휴무처럼 평소와 다른 날. 평소 대비 계산과 효과 판정에서 뺀다.
function SpecialDays({ storeId, days, onChanged }: { storeId: string; days: { date: string; note: string }[]; onChanged: () => void }) {
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, startBusy] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  function add() {
    setErr(null);
    startBusy(async () => {
      const r = await addSpecialDay(storeId, date, note);
      if (!r.ok) setErr(r.error);
      else {
        setDate("");
        setNote("");
        onChanged();
      }
    });
  }
  function remove(d: string) {
    startBusy(async () => {
      const r = await removeSpecialDay(storeId, d);
      if (!r.ok) setErr(r.error);
      else onChanged();
    });
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-bold">특이일 (비교에서 제외)</h2>
      <p className="mb-2 text-[11px] text-muted">단체 예약·행사·임시 휴무처럼 평소와 다른 날을 적어 두면 평소 대비와 광고 효과 판정에서 빼요.</p>
      <div className="flex gap-1.5">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 단체 40명" maxLength={40} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground" />
        <button type="button" onClick={add} disabled={busy || !date} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
          추가
        </button>
      </div>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      {days.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {days.map((s) => (
            <li key={s.date} className="flex items-center justify-between rounded-lg bg-background px-3 py-1.5 text-xs">
              <span>
                <span className="tabular-nums text-muted">{s.date.slice(5).replace("-", "/")}</span> {s.note}
              </span>
              <button type="button" onClick={() => remove(s.date)} disabled={busy} className="text-[11px] text-muted underline">
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
