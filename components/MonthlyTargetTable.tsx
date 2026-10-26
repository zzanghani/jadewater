"use client";

import { useEffect, useState, useTransition } from "react";
import { loadMonthlyTargets, saveMonthlyTarget, type TargetRow, type TargetsResult } from "@/app/(app)/targets/actions";
import { formatWon } from "@/lib/format";

const STATUS = {
  done: { label: "달성", cls: "bg-green-50 text-green-700" },
  likely: { label: "달성 예상", cls: "bg-green-50 text-green-700" },
  close: { label: "근접", cls: "bg-amber-50 text-amber-700" },
  behind: { label: "미달 예상", cls: "bg-red-50 text-red-600" },
  none: { label: "목표 없음", cls: "bg-gray-100 text-gray-500" },
} as const;

const man = (n: number | null) => (n == null ? "-" : n >= 10000 ? `${(n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}만` : formatWon(n));

// 월 매출 목표: 목표 · 누적 · 달성률 · 월말 예상 · 남은 날 하루 필요 · 평소 페이스 · 상태. 마스터는 목표를 바로 고친다.
export default function MonthlyTargetTable() {
  const [res, setRes] = useState<TargetsResult | null>(null);
  const [loading, start] = useTransition();
  useEffect(() => {
    start(async () => setRes(await loadMonthlyTargets()));
  }, []);
  function reload() {
    start(async () => setRes(await loadMonthlyTargets()));
  }
  if (!res) return <section className="rounded-2xl border border-border bg-card p-4 text-xs text-muted">{loading ? "월 목표를 계산하는 중..." : ""}</section>;
  if (!res.ok) return null;
  const single = res.rows.length === 1;
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">{Number(res.month.slice(5))}월 매출 목표</h2>
        <span className="text-[11px] text-muted">누적은 어제까지 · 월말 예상은 최근 4주 같은 요일 평균</span>
      </div>
      <div className={single ? "" : "flex flex-col gap-2"}>
        {res.rows.map((r) => (
          <TargetCard key={r.storeId} r={r} month={res.month} canEdit={res.canEdit} onSaved={reload} />
        ))}
      </div>
    </section>
  );
}

function TargetCard({ r, month, canEdit, onSaved }: { r: TargetRow; month: string; canEdit: boolean; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(r.target ? String(Math.round(r.target / 10000)) : "");
  const [saving, startSave] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const st = STATUS[r.status];
  const pct = r.rate == null ? 0 : Math.min(100, r.rate);
  function save() {
    setErr(null);
    startSave(async () => {
      const x = await saveMonthlyTarget(r.storeId, month, Number(val) * 10000);
      if (!x.ok) setErr(x.error);
      else {
        setEdit(false);
        onSaved();
      }
    });
  }
  return (
    <div className="rounded-xl bg-background px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{r.name}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2 text-xs">
        <span className="text-muted">목표</span>
        {edit ? (
          <span className="flex items-center gap-1">
            <input type="number" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-right text-xs text-foreground" placeholder="0" />
            <span className="text-muted">만원</span>
            <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-brand px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
              저장
            </button>
            <button type="button" onClick={() => setEdit(false)} className="text-[11px] text-muted underline">
              취소
            </button>
          </span>
        ) : (
          <>
            <span className="font-bold tabular-nums">{r.target ? formatWon(r.target) : "-"}</span>
            {canEdit && (
              <button type="button" onClick={() => setEdit(true)} className="text-[11px] text-brand underline">
                {r.target ? "수정" : "목표 넣기"}
              </button>
            )}
          </>
        )}
      </div>
      {err && <p className="text-[11px] text-red-600">{err}</p>}
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${r.status === "behind" ? "bg-red-500" : r.status === "close" ? "bg-amber-500" : "bg-brand"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1 text-[11px] tabular-nums">
        <div>
          <p className="text-muted">누적 ({r.mtdDays}일)</p>
          <p className="font-semibold">
            {man(r.mtd)}
            {r.rate != null && <span className="ml-1 text-muted">{r.rate.toFixed(0)}%</span>}
          </p>
        </div>
        <div>
          <p className="text-muted">월말 예상</p>
          <p className="font-semibold">
            {man(r.projected)}
            {r.projectedRate != null && <span className={`ml-1 ${r.projectedRate >= 100 ? "text-green-700" : r.projectedRate >= 90 ? "text-amber-700" : "text-red-600"}`}>{r.projectedRate.toFixed(0)}%</span>}
          </p>
        </div>
        <div>
          <p className="text-muted">남은 {r.remainingDays}일 하루 필요</p>
          <p className="font-semibold">
            {r.needPerDay == null ? "-" : man(r.needPerDay)}
            <span className="ml-1 text-muted">평소 {man(r.pace)}</span>
          </p>
        </div>
      </div>
      {r.source === "closing" && <p className="mt-1 text-[10px] text-muted">마감입력 기준 (토스 연결 전)</p>}
    </div>
  );
}
