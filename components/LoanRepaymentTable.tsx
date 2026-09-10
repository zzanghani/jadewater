"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  addLoanRepaymentEvent,
  deleteLoanRepayment,
  deleteLoanRepaymentEvent,
  saveLoanRepayment,
  updateLoanRepayment,
} from "@/app/(app)/loans/actions";
import { kstDateString, kstShortDateLabel } from "@/lib/date";
import { formatWon } from "@/lib/format";
import type { LoanRepayment, LoanRepaymentEvent } from "@/lib/types";

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

const inputClass =
  "rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-brand/30 focus:ring-2";

export default function LoanRepaymentTable({
  rows,
  events,
  storeNames,
}: {
  rows: LoanRepayment[];
  events: LoanRepaymentEvent[];
  /** 앱에 등록된 매장 이름 — 매장 입력칸 자동완성용. 표에는 없는 매장도 자유롭게 적을 수 있다. */
  storeNames: string[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null); // 매장명 미리 채워서 열기

  // 매장별로 묶되, 표에 나온 순서(sort_order) 그대로 유지
  const groups: { store: string; items: LoanRepayment[] }[] = [];
  for (const r of rows) {
    const g = groups.find((x) => x.store === r.store_name);
    if (g) g.items.push(r);
    else groups.push({ store: r.store_name, items: [r] });
  }
  const eventsByLoan = new Map<string, LoanRepaymentEvent[]>();
  for (const e of events) {
    const list = eventsByLoan.get(e.loan_id) ?? [];
    list.push(e);
    eventsByLoan.set(e.loan_id, list);
  }

  const totalPrincipal = rows.reduce((a, r) => a + r.principal, 0);
  const totalRepaid = rows.reduce((a, r) => a + r.repaid, 0);
  const suggestions = Array.from(new Set([...storeNames, ...rows.map((r) => r.store_name)]));

  // 수정 중인 줄은 서버에서 다시 내려온 최신 값을 쓴다 (상환 기록 추가 후 합계 반영).
  const editing = editingId ? rows.find((r) => r.id === editingId) ?? null : null;

  if (editing) {
    return (
      <LoanDetail
        entry={editing}
        events={eventsByLoan.get(editing.id) ?? []}
        suggestions={suggestions}
        onDone={() => setEditingId(null)}
      />
    );
  }
  if (adding !== null) {
    return (
      <LoanForm defaultStore={adding} suggestions={suggestions} onDone={() => setAdding(null)} />
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
                  const latest = eventsByLoan.get(r.id)?.[0];
                  const count = eventsByLoan.get(r.id)?.length ?? 0;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setEditingId(r.id)}
                      className="cursor-pointer border-t border-border active:bg-background"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold">{r.investor_name}</p>
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-brand-light">
                          <div className="h-full rounded-full bg-brand-dark" style={{ width: `${pct}%` }} />
                        </div>
                        {latest && (
                          <p className="mt-1 text-[11px] text-muted">
                            {count}회 · 최근 {kstShortDateLabel(latest.paid_on)}
                          </p>
                        )}
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
      <p className="text-center text-[11px] text-muted">줄을 누르면 상환 기록을 추가하거나 수정·삭제할 수 있어요</p>
    </div>
  );
}

// 한 줄 상세 — 상환 기록 추가/삭제 + 기본 정보 수정.
function LoanDetail({
  entry,
  events,
  suggestions,
  onDone,
}: {
  entry: LoanRepayment;
  events: LoanRepaymentEvent[];
  suggestions: string[];
  onDone: () => void;
}) {
  const [editingInfo, setEditingInfo] = useState(false);
  // 금액 칸은 비제어 입력 — 저장이 끝나면 React가 폼을 자동으로 비워준다.
  const [state, formAction, pending] = useActionState(addLoanRepaymentEvent, undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();

  if (editingInfo) {
    return <LoanForm entry={entry} suggestions={suggestions} onDone={() => setEditingInfo(false)} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onDone} className="self-start text-sm font-medium text-muted">
        ← 상환표로
      </button>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted">{entry.store_name}</p>
            <p className="text-lg font-bold">{entry.investor_name}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditingInfo(true)}
            className="rounded-md bg-brand-light px-2 py-1 text-[11px] font-medium text-brand"
          >
            정보 수정
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted">투자금</p>
            <p className="font-semibold">{formatWon(entry.principal)}</p>
          </div>
          <div>
            <p className="text-muted">상환액</p>
            <p className="font-semibold">{formatWon(entry.repaid)}</p>
          </div>
          <div>
            <p className="text-muted">잔액</p>
            <p className="font-semibold">{formatWon(entry.principal - entry.repaid)}</p>
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-light">
          <div
            className="h-full rounded-full bg-brand-dark"
            style={{ width: `${entry.principal ? Math.min(100, (entry.repaid / entry.principal) * 100) : 0}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs font-semibold text-brand">{ratio(entry.repaid, entry.principal)}</p>
        {entry.notes && <p className="mt-2 text-xs text-muted">{entry.notes}</p>}
      </section>

      <form action={formAction} className="flex flex-col gap-2 rounded-2xl border border-brand bg-card p-4">
        <input type="hidden" name="loan_id" value={entry.id} />
        <p className="text-sm font-semibold">상환 기록 추가</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            날짜
            <input
              type="date"
              name="paid_on"
              required
              defaultValue={kstDateString(0)}
              max={kstDateString(0)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            금액
            <div className="flex items-center rounded-xl border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-brand/30">
              <input
                type="text"
                inputMode="numeric"
                name="amount"
                required
                onChange={(e) => {
                  e.target.value = formatDigits(parseDigits(e.target.value));
                }}
                placeholder="0"
                className="w-full bg-transparent py-2.5 text-right text-sm text-foreground outline-none"
              />
              <span className="ml-1 text-sm text-muted">원</span>
            </div>
          </label>
        </div>
        <input
          type="text"
          name="notes"
          placeholder="메모 (선택) 예: 9월 상환"
          className={inputClass}
        />
        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "저장 중..." : "상환 기록 저장"}
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-bold">상환 기록</p>
          <p className="text-xs text-muted">{events.length}회</p>
        </div>
        {events.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">아직 상환 기록이 없어요.</p>
        ) : (
          <ul>
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 border-t border-border px-4 py-3 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-muted">{e.paid_on}</span>
                <span className="flex-1 truncate text-xs text-muted">{e.notes ?? ""}</span>
                <span className="font-semibold tabular-nums">{formatWon(e.amount)}</span>
                <button
                  type="button"
                  disabled={deletingId === e.id}
                  onClick={() => {
                    if (!confirm(`${e.paid_on} ${formatWon(e.amount)} 기록을 삭제할까요?`)) return;
                    setDeletingId(e.id);
                    startDelete(async () => {
                      await deleteLoanRepaymentEvent(e.id);
                      setDeletingId(null);
                    });
                  }}
                  className="text-xs text-red-500 disabled:opacity-60"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// 기본 정보(매장·투자자·투자금·비고) 입력/수정. 상환액은 여기서 안 만진다.
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

  useEffect(() => {
    if (state?.success) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-brand bg-card p-4">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <p className="text-sm font-semibold">{entry ? "정보 수정" : "투자자 추가"}</p>

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

      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        투자금
        <div className="flex items-center rounded-xl border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-brand/30">
          <input
            type="text"
            inputMode="numeric"
            name="principal"
            value={principal}
            onChange={(e) => setPrincipal(formatDigits(parseDigits(e.target.value)))}
            placeholder="0"
            className="w-full bg-transparent py-2.5 text-right text-sm text-foreground outline-none"
          />
          <span className="ml-1 text-sm text-muted">원</span>
        </div>
      </label>
      {!entry && (
        <p className="text-[11px] text-muted">상환액은 저장 후 상세 화면에서 날짜별 기록으로 추가해요.</p>
      )}

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
            if (!confirm(`${entry.store_name} · ${entry.investor_name} 줄과 상환 기록을 모두 삭제할까요?`)) return;
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
