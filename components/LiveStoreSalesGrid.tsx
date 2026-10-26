"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadLiveSales, type LiveSales } from "@/app/(app)/live/actions";
import { formatWon } from "@/lib/format";

type StoreCard = { id: string; name: string; color: string; sales: number };

// 마스터·마케팅팀 홈의 매장 카드. 토스가 연결된 매장은 실시간 결제 합계로 바꿔 보여주고,
// 화면이 열려 있는 동안 2분마다 다시 읽는다. 연결 안 된 매장은 마감입력 금액 그대로.
export default function LiveStoreSalesGrid({ stores }: { stores: StoreCard[] }) {
  const [live, setLive] = useState<Record<string, LiveSales>>({});
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
  return (
    <div className="grid grid-cols-2 gap-3">
      {stores.map((s) => {
        const l = live[s.id];
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
          </Link>
        );
      })}
    </div>
  );
}
