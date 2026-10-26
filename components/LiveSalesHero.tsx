"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadLiveSales, type LiveSales } from "@/app/(app)/live/actions";
import { formatWon } from "@/lib/format";

// 지점장·직원 홈의 오늘 매출 큰 카드. 토스가 연결돼 있으면 실시간 결제 합계로 바꾼다.
export default function LiveSalesHero({
  storeId,
  todayLabel,
  closingSales,
  guestsLabel,
  guestsText,
}: {
  storeId: string;
  todayLabel: string;
  closingSales: number;
  guestsLabel: string;
  guestsText: string;
}) {
  const [live, setLive] = useState<LiveSales | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      loadLiveSales()
        .then((r) => alive && setLive(r[storeId] ?? null))
        .catch(() => null);
    tick();
    const id = setInterval(tick, 120e3);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [storeId]);
  return (
    <Link href={`/store/${storeId}`} className="block rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-5 text-white shadow-lg shadow-brand/25 transition-opacity active:opacity-90">
      <div className="flex items-center justify-between text-sm text-white/80">
        <span>{live ? "오늘 매출 · 실시간" : "오늘 매출"}</span>
        <span>{todayLabel}</span>
      </div>
      <p className="mt-1 text-3xl font-bold">{formatWon(live ? live.sales : closingSales)}</p>
      {live && (
        <p className="mt-1 text-xs text-white/75">
          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-300 align-middle" />
          결제 {formatWon(live.paid)} ({live.orders}건){live.openOrders > 0 && ` + 미결제 ${formatWon(live.openAmount)} (${live.openOrders}건)`}
          {live.lastPayAt && ` · 마지막 결제 ${live.lastPayAt}`}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-white/20 pt-3">
        <span className="text-sm text-white/80">{guestsLabel}</span>
        <span className="text-lg font-semibold">{guestsText}</span>
      </div>
    </Link>
  );
}
