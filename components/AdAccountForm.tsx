"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteAdAccount, saveAdAccount } from "@/app/(app)/ad-report/actions";
import type { StoreAdAccount } from "@/lib/types";

const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground";
const mask = (s: string) => (s.length <= 4 ? "••••" : "•".repeat(Math.min(12, s.length - 4)) + s.slice(-4));

export default function AdAccountForm({ storeId, storeName, account }: { storeId: string; storeName: string; account: StoreAdAccount | null }) {
  const [open, setOpen] = useState(!account);
  const [state, formAction, pending] = useActionState(saveAdAccount, undefined);
  const [deleting, startDelete] = useTransition();

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-bold">{storeName}</span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${account?.enabled ? "bg-green-50 text-green-700" : account ? "bg-gray-100 text-gray-500" : "bg-amber-50 text-amber-700"}`}>
          {account ? (account.enabled ? "연결됨" : "꺼짐") : "미연결"}
        </span>
      </button>

      {open && (
        <form action={formAction} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="store_id" value={storeId} />
          <label className="flex flex-col gap-1 text-xs text-muted">
            고객 ID (CUSTOMER_ID)
            <input name="naver_customer_id" defaultValue={account?.naver_customer_id ?? ""} className={inputClass} inputMode="numeric" required />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            엑세스라이선스 (API KEY){account && <span className="text-[10px]"> · 비워두면 기존 값 유지 ({mask(account.naver_api_key)})</span>}
            <input name="naver_api_key" className={inputClass} autoComplete="off" placeholder={account ? "변경할 때만 입력" : ""} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            비밀키 (SECRET KEY){account && <span className="text-[10px]"> · 비워두면 기존 값 유지 ({mask(account.naver_secret_key)})</span>}
            <input name="naver_secret_key" type="password" className={inputClass} autoComplete="off" placeholder={account ? "변경할 때만 입력" : ""} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              월 광고 예산 (원, 선택)
              <input name="monthly_budget" defaultValue={account?.monthly_budget ?? ""} className={inputClass} inputMode="numeric" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              목표 전환당 비용 (원, 선택)
              <input name="target_cpa" defaultValue={account?.target_cpa ?? ""} className={inputClass} inputMode="numeric" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="enabled" defaultChecked={account?.enabled ?? true} /> 리포트에 포함
          </label>

          {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>}
          {state?.success && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
              연결 확인 후 저장했어요{state.bizmoney != null && ` · 비즈머니 ${state.bizmoney.toLocaleString()}원`}
            </p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {pending ? "네이버에 연결해 보는 중..." : "연결 확인하고 저장"}
            </button>
            {account && (
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  if (!confirm(`${storeName} 광고 키를 삭제할까요?`)) return;
                  startDelete(async () => {
                    await deleteAdAccount(storeId);
                  });
                }}
                className="rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-red-500 disabled:opacity-60"
              >
                삭제
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
