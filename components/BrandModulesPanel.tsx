"use client";

import { useState, useTransition } from "react";
import { setBrandModule } from "@/app/(app)/modules/actions";

type BrandRow = { id: string; name: string; storeCount: number };
type ModuleRow = { key: string; name: string; summary: string; priceMonthly: number };
type StateRow = {
  brand_id: string;
  module_key: string;
  status: string;
  trial_ends_at: string | null;
  note: string | null;
  updated_at: string;
};

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }).format(new Date(iso));
}

export default function BrandModulesPanel({
  brands,
  modules,
  rows,
}: {
  brands: BrandRow[];
  modules: ModuleRow[];
  rows: StateRow[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const stateOf = (brandId: string, key: string) => rows.find((r) => r.brand_id === brandId && r.module_key === key);

  function change(brandId: string, key: string, status: "active" | "trial" | "inactive") {
    setError(null);
    setBusyKey(`${brandId}:${key}`);
    startTransition(async () => {
      const res = await setBrandModule({ brandId, moduleKey: key, status });
      if (res?.error) setError(res.error);
      setBusyKey(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {brands.map((b) => {
        const monthly = modules.reduce((sum, m) => {
          const st = stateOf(b.id, m.key);
          return st?.status === "active" ? sum + m.priceMonthly * b.storeCount : sum;
        }, 0);
        return (
          <section key={b.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-bold">{b.name}</h2>
              <span className="text-xs text-muted">매장 {b.storeCount}개</span>
            </div>
            <div className="mt-3 flex flex-col divide-y divide-border">
              {modules.map((m) => {
                const st = stateOf(b.id, m.key);
                const status = (st?.status ?? "inactive") as "active" | "trial" | "inactive";
                const trialLive = status === "trial" && (!st?.trial_ends_at || new Date(st.trial_ends_at).getTime() > Date.now());
                const on = status === "active" || trialLive;
                const busy = pending && busyKey === `${b.id}:${m.key}`;
                return (
                  <div key={m.key} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {m.name}
                        <span className="ml-1.5 text-xs font-normal text-muted">월 {m.priceMonthly.toLocaleString()}원/매장</span>
                      </p>
                      <p className="truncate text-xs text-muted">{m.summary}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {status === "active" && "사용 중"}
                        {status === "trial" && (trialLive ? `체험 중 · ${fmtDate(st?.trial_ends_at ?? null)}까지` : "체험 기간 끝남")}
                        {status === "inactive" && "꺼짐"}
                        {st?.note ? ` · ${st.note}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!on && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => change(b.id, m.key, "trial")}
                          className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted disabled:opacity-50"
                          title="30일 체험"
                        >
                          체험 30일
                        </button>
                      )}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        disabled={busy}
                        onClick={() => change(b.id, m.key, on ? "inactive" : "active")}
                        className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-brand" : "bg-border"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform left-0.5`}
                          style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-right text-xs text-muted">
              추가 기능 합계(초안) <b className="text-foreground">월 {monthly.toLocaleString()}원</b>
            </p>
          </section>
        );
      })}

      <p className="text-xs text-muted">
        요금은 초안이에요. 결제 기능이 붙으면 브랜드가 직접 켜고 카드로 매월 결제하게 되고, 이 화면은 결제 상태를 보는
        화면으로 바뀝니다.
      </p>
    </div>
  );
}
