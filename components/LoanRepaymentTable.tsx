"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  deleteLoanRepayment,
  saveLoanRepayment,
  updateLoanRepayment,
} from "@/app/(app)/loans/actions";
import { formatWon } from "@/lib/format";
import type { LoanRepayment } from "@/lib/types";

function ratio(repaid: number, principal: number): string {
  if (!principal) return "-";
  return `${Math.round((repaid / principal) * 1000) / 10}%`;
}

function formatDigits(n: number | null | undefined): string {
  return n ? n.toLocaleString() : "";
}

function parseDigits(s: string): number {
  const digits = s.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export default function LoanRepaymentTable({
  rows,
  storeNames,
}: {
  rows: LoanRepayment[];
  /** 앱에 등록된 매장 이름 — 매장 입력칸 자동완성용. 표에는 없는 매장도 자유롭게 적을 수 있다. */
  storeNames: string[];
}) {
  const [editing, setEditing] = useState<LoanRepayment | null>(null);
  const [adding, setAdding] = useState<string | null>(null); // 매장명 미리 채워서 열기

  // 매장별로 묶되, 표에 나온 순서(sort_order) 그대로 유지
  const groups: { store: string; items: LoanRepayment[] }[] = [];
  for (const r of rows) {
    const g = groups.find((x) => x.store === r.store_name);
    if (g) g.items.push(r);
    else groups.push({ store: r.store_name, items: [r] });
  }

  const totalPrincipal = rows.reduce((a, r) => a + r.principal, 0);
  const totalRepaid = rows.reduce((a, r) => a + r.repaid, 0);
  const suggestions = Array.from(new Set([...storeNames, ...rows.map((r) => r.store_name)]));

  if (editing) {
    return (
      <LoanForm
        entry={editing}
        suggestions={suggestions}
        onDone={() => setEditing(null)}
      />
    );
  }
  if (adding !== null) {
    return (
      <LoanForm
        defaultStore={adding}
        suggestions={suggestions}
        onDone={() => setAdding(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-4 text-white shadow-lg shadow-brand/25">
        <p className="text-sm text-white/85">전체 상환 진행</p>
        <p className="mt-1 text-2xl font-bold">{ratio(totalRepaid, totalPrincipal)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-white/70">투자금</p>
            <p className="font-semibold">{formatWon(totalPrincipal)}</p>
          </div>
          <div>
            <p className="text-white/70">상환액</p>
            <p className="font-semibold">{formatWon(totalRepaid)}</p>
          </div>
          <div>
            <p className="text-white/70">잔액</p>
            <p className="font-semibold">{formatWon(totalPrincipal - totalRepaid)}</p>
          </div>
        </div>
      </section>

      {groups.map((g) => {
        const gp = g.items.reduce((a, r) => a + r.principal, 0);
        const gr = g.items.reduce((a, r) => a + r.repaid, 0);
        return (
          <section key={g.store} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-bold">{g.store}</p>
              <p className="text-xs text-muted">
                {formatWon(gr)} / {formatWon(gp)} · <span className="font-semibold text-brand">{ratio(gr, gp)}</span>
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted">
                  <th className="px-4 py-2 text-left font-medium">투자자</th>
                  <th className="px-2 py-2 text-right font-medium">투자금</th>
                  <th className="px-2 py-2 text-right font-medium">상환액</th>
                  <th className="px-4 py-2 text-right font-medium">비율</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((r) => {
                  const pct = r.principal ? Math.min(100, (r.repaid / r.principal) * 100) : 0;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setEditing(r)}
                      className="cursor-pointer border-t border-border active:bg-background"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold">{r.investor_name}</p>
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-brand-light">
                          <div className="h-full rounded-full bg-brand-dark" style={{ width: `${pct}%` }} />
                        </div>
                        {r.notes && <p className="mt-1 text-[11px] text-muted">{r.notes}</p>}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">{formatWon(r.principal)}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{formatWon(r.repaid)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-brand">
                        {ratio(r.repaid, r.principal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => setAdding(g.store)}
              className="w-full border-t border-border py-2.5 text-xs font-medium text-muted"
            >
              + {g.store}에 투자자 추가
            </button>
          </section>
        );
      })}

      <button
        type="button"
        onClick={() => setAdding("")}
        className="rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30"
      >
        + 새 매장·투자자 추가
      </button>
      <p className="text-center text-[11px] text-muted">줄을 누르면 수정·삭제할 수 있어요</p>
    </div>
  );
}

function LoanForm({
  entry,
  defaultStore,
  suggestions,
  onDone,
}: {
  entry?: LoanRepayment;
  defaultStore?: string;
  suggestions: string[];
  onDone: () => void;
}) {
  const action = entry ? updateLoanRepayment : saveLoanRepayment;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [deleting, startDelete] = useTransition();
  const [principal, setPrincipal] = useState(formatDigits(entry?.principal));
  const [repaid, setRepaid] = useState(formatDigits(entry?.repaid));

  useEffect(() => {
    if (state?.success) onDone();
  }, [state, onDone]);

  const inputClass =
    "rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-brand/30 focus:ring-2";

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-brand bg-card p-4">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <p className="text-sm font-semibold">{entry ? "내역 수정" : "투자자 추가"}</p>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        매장
        <input
          type="text"
          name="store_name"
          required
          list="loan-store-names"
          defaultValue={entry?.store_name ?? defaultStore ?? ""}
          placeholder="예: 제이드앤워터 서울역"
          className={inputClass}
        />
        <datalist id="loan-store-names">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        투자자
        <input
          type="text"
          name="investor_name"
          required
          defaultValue={entry?.investor_name ?? ""}
          placeholder="이름"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <AmountField label="투자금" name="principal" value={principal} onChange={setPrincipal} />
        <AmountField label="상환액" name="repaid" value={repaid} onChange={setRepaid} />
      </div>
      <p className="rounded-lg bg-brand-light px-3 py-2 text-xs text-brand-dark">
        상환비율 {ratio(parseDigits(repaid), parseDigits(principal))} · 잔액{" "}
        {formatWon(parseDigits(principal) - parseDigits(repaid))}
      </p>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        비고
        <input
          type="text"
          name="notes"
          defaultValue={entry?.notes ?? ""}
          placeholder="예: 인테리어+보증금, 2025-09 상환 시작"
          className={inputClass}
        />
      </label>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>

      {entry && (
        <button
          type="button"
          disabled={deleting}
          onClick={() => {
            if (!confirm(`${entry.store_name} · ${entry.investor_name} 줄을 삭제할까요?`)) return;
            startDelete(async () => {
              await deleteLoanRepayment(entry.id);
              onDone();
            });
          }}
          className="text-xs font-medium text-red-500 disabled:opacity-60"
        >
          {deleting ? "삭제 중..." : "이 줄 삭제"}
        </button>
      )}
    </form>
  );
}

function AmountField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <div className="flex items-center rounded-xl border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-brand/30">
        <input
          type="text"
          inputMode="numeric"
          name={name}
          value={value}
          onChange={(e) => onChange(formatDigits(parseDigits(e.target.value)))}
          placeholder="0"
          className="w-full bg-transparent py-2.5 text-right text-sm text-foreground outline-none"
        />
        <span className="ml-1 text-sm text-muted">원</span>
      </div>
    </label>
  );
}
