"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadLiveSales, type LiveSales } from "@/app/(app)/live/actions";
import { loadMonthlyTargets, type TargetRow } from "@/app/(app)/targets/actions";
import { formatWon } from "@/lib/format";

type StoreCard = { id: string; name: string; color: string; sales: number };

// 마스터·마케팅팀 홈의 매장 카드. 토스가 연결된 매장은 실시간 결제 합계로 바꿔 보여주고,
// 화면이 열려 있는 동안 2분마다 다시 읽는다. 연결 안 된 매장은 마감입력 금액 그대로.
// 타일 아래에는 그 매장의 이번 달 목표 달성률(지점장이 정한 목표 기준)을 얇은 바로 보여준다.
export default function LiveStoreSalesGrid({ stores }: { stores: StoreCard[] }) {
  const [live, setLive] = useState<Record<string, LiveSales>>({});
  const [targets, setTargets] = useState<Record<string, TargetRow>>({});
  useEffect(() => {
    loadMonthlyTargets()
      .then((r) => r.ok && setTargets(Object.fromEntries(r.rows.map((row) => [row.storeId, row]))))
      .catch(() => null);
  }, []);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      loadLiveSales()
        .then((r) => alive && setLive(r))
        .catch(() => null);
    tick();
    const id = setInterval(tick, 120e3);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const liveStores = stores.filter((s) => live[s.id]);
  const total = stores.reduce((sum, s) => sum + (live[s.id]?.sales ?? s.sales), 0);
  const lwSame = liveStores.reduce((sum, s) => sum + (live[s.id].lastWeekSameTime ?? 0), 0);
  const lwHas = liveStores.some((s) => live[s.id].lastWeekSameTime != null);
  const liveSum = liveStores.reduce((sum, s) => sum + live[s.id].sales, 0);
  const estSum = liveStores.reduce((sum, s) => sum + (live[s.id].estimate ?? live[s.id].sales), 0);
  const estHas = liveStores.some((s) => live[s.id].estimate != null);
  const d = lwHas && lwSame > 0 ? ((liveSum - lwSame) / lwSame) * 100 : null;
  return (
    <div className="flex flex-col gap-3">
      {stores.length > 1 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-muted">전 매장 오늘 합계</p>
            {liveStores.length > 0 && (
              <p className="text-[11px] text-muted">
                실시간 {liveStores.length}곳{liveStores.length < stores.length && ` · 나머지 ${stores.length - liveStores.length}곳 마감입력`}
              </p>
            )}
          </div>
          <p className="text-2xl font-bold tabular-nums">{formatWon(total)}</p>
          {liveStores.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-background px-3 py-2">
                <p className="text-muted">지난주 같은 요일 지금 시각</p>
                <p className="font-semibold tabular-nums">
                  {lwHas ? formatWon(lwSame) : "자료 없음"}
                  {d != null && <span className={`ml-1 ${d >= 0 ? "text-green-700" : "text-red-600"}`}>{d >= 0 ? "▲" : "▼"}{Math.abs(d).toFixed(0)}%</span>}
                </p>
              </div>
              <div className="rounded-xl bg-background px-3 py-2">
                <p className="text-muted">마감 추정 (실시간 매장)</p>
                <p className="font-semibold tabular-nums">{estHas ? formatWon(estSum) : "영업 초반이라 아직"}</p>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {stores.map((s) => {
          const l = live[s.id];
          const ld = l && l.lastWeekSameTime ? ((l.sales - l.lastWeekSameTime) / l.lastWeekSameTime) * 100 : null;
          const t = targets[s.id];
          const tPct = t?.rate == null ? 0 : Math.min(100, t.rate);
          return (
            <Link key={s.id} href={`/store/${s.id}`} style={{ backgroundColor: s.color }} className="rounded-2xl p-4 text-white shadow-lg transition-opacity active:opacity-80">
              <p className="text-xs leading-tight text-white/85">{s.name}</p>
              <p className="mt-1 text-lg font-bold">{formatWon(l ? l.sales : s.sales)}</p>
              <p className="mt-0.5 text-[10px] text-white/75">
                {l ? (
                  <>
                    <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-300 align-middle" />
                    실시간 · 결제 {l.orders}건{l.openOrders > 0 && ` + 미결제 ${l.openOrders}건`}{l.lastPayAt && ` · 마지막 ${l.lastPayAt}`}
                  </>
                ) : (
                  "마감입력 기준"
                )}
              </p>
              {l && (ld != null || l.estimate != null) && (
                <p className="mt-1 text-[10px] text-white/85">
                  {ld != null && <>지난주 동시각 {ld >= 0 ? "▲" : "▼"}{Math.abs(ld).toFixed(0)}%</>}
                  {ld != null && l.estimate != null && " · "}
                  {l.estimate != null && <>마감 추정 {formatWon(l.estimate)}</>}
                </p>
              )}
              {t && (
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/30">
                    <div className={`h-full rounded-full ${t.status === "behind" ? "bg-red-300" : t.status === "close" ? "bg-amber-300" : "bg-white"}`} style={{ width: `${tPct}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-white/85 tabular-nums">
                    {t.target ? (
                      <>
                        {Number(t.target) >= 10000 ? `목표 ${Math.round(t.target / 10000).toLocaleString()}만` : `목표 ${formatWon(t.target)}`} · 달성 {t.rate!.toFixed(0)}%
                        {t.projectedRate != null && <> · 월말 예상 {t.projectedRate.toFixed(0)}%</>}
                      </>
                    ) : (
                      "이달 목표 없음 (지점장이 정함)"
                    )}
                  </p>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
