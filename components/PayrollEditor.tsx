"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  copyPreviousMonthPayroll,
  deletePayrollEntry,
  savePayrollEntry,
  sendPayrollReport,
  updatePayrollEntry,
} from "@/app/(app)/payroll/actions";
import { formatWon } from "@/lib/format";
import type { PayrollEntry, PayrollPosition } from "@/lib/types";

const POSITIONS: PayrollPosition[] = ["점장", "부점장", "팀장", "사원", "파트타이머"];

function rowTotal(r: Pick<PayrollEntry, "base_pay" | "bonus" | "extra_pay">) {
  return r.base_pay + r.bonus + r.extra_pay;
}

export default function PayrollEditor({
  storeId,
  month,
  rows,
  hasPreviousMonth,
}: {
  storeId: string;
  /** YYYY-MM */
  month: string;
  rows: PayrollEntry[];
  hasPreviousMonth: boolean;
}) {
  const [editing, setEditing] = useState<PayrollEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copying, startCopy] = useTransition();
  const [mailMessage, setMailMessage] = useState<string | null>(null);
  const [mailing, startMail] = useTransition();

  const totals = rows.reduce(
    (acc, r) => ({
      base: acc.base + r.base_pay,
      bonus: acc.bonus + r.bonus,
      extra: acc.extra + r.extra_pay,
    }),
    { base: 0, bonus: 0, extra: 0 }
  );
  const grandTotal = totals.base + totals.bonus + totals.extra;

  if (editing) {
    return (
      <PayrollForm
        storeId={storeId}
        month={month}
        entry={editing}
        onDone={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-4 text-white shadow-lg shadow-brand/25">
        <p className="text-sm text-white/85">이번 달 총 지급액</p>
        <p className="mt-1 text-2xl font-bold">{formatWon(grandTotal)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-white/70">계약총급여</p>
            <p className="font-semibold">{formatWon(totals.base)}</p>
          </div>
          <div>
            <p className="text-white/70">상여금</p>
            <p className="font-semibold">{formatWon(totals.bonus)}</p>
          </div>
          <div>
            <p className="text-white/70">추가수당</p>
            <p className="font-semibold">{formatWon(totals.extra)}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-white/70">{rows.length}명</p>
      </section>

      {rows.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted">아직 이번 달 내역이 없어요.</p>
          {hasPreviousMonth && (
            <button
              type="button"
              disabled={copying}
              onClick={() =>
                startCopy(async () => {
                  const result = await copyPreviousMonthPayroll(storeId, month);
                  setCopyMessage(
                    result.error ?? `지난달 명단 ${result.copied}명을 불러왔어요. 상여·수당만 채우면 돼요.`
                  );
                })
              }
              className="rounded-xl border border-brand bg-brand-light py-2.5 text-sm font-semibold text-brand disabled:opacity-60"
            >
              {copying ? "불러오는 중..." : "지난달 명단 불러오기"}
            </button>
          )}
          {copyMessage && <p className="text-xs text-muted">{copyMessage}</p>}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const isPartTimer = r.position === "파트타이머";
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {r.employee_name}
                      {r.position && (
                        <span className="ml-1.5 text-xs font-medium text-muted">{r.position}</span>
                      )}
                    </p>
                    <p className="flex items-center gap-2 text-sm font-bold text-brand">
                      {formatWon(rowTotal(r))}
                      <span className="rounded-md bg-brand-light px-1.5 py-0.5 text-[10px] font-medium text-brand">
                        수정
                      </span>
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted">
                    <span>
                      {isPartTimer
                        ? `시급 ${formatWon(r.hourly_rate ?? 0)} × ${r.work_hours ?? 0}h`
                        : `급여 ${formatWon(r.base_pay)}`}
                    </span>
                    <span>상여 {formatWon(r.bonus)}</span>
                    <span>수당 {formatWon(r.extra_pay)}</span>
                  </div>
                  {r.notes && <p className="text-xs text-muted">{r.notes}</p>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <PayrollForm storeId={storeId} month={month} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30"
        >
          + 직원 추가
        </button>
      )}

      {rows.length > 0 && !adding && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">작성 완료했으면 본사로 보내기</p>
          <p className="text-xs text-muted">이번 달 내역 전체가 lee@bestmateco.com 으로 발송돼요.</p>
          <button
            type="button"
            disabled={mailing}
            onClick={() => {
              if (!confirm(`${rows.length}명 급여 내역을 메일로 보낼까요?`)) return;
              startMail(async () => {
                const result = await sendPayrollReport(storeId, month);
                setMailMessage(result.error ?? "메일을 보냈어요.");
              });
            }}
            className="rounded-xl border border-brand bg-brand-light py-2.5 text-sm font-semibold text-brand disabled:opacity-60"
          >
            {mailing ? "보내는 중..." : "메일로 보내기"}
          </button>
          {mailMessage && <p className="text-xs text-muted">{mailMessage}</p>}
        </div>
      )}
    </div>
  );
}

function formatDigits(n: number | null | undefined): string {
  return n ? n.toLocaleString() : "";
}

function parseDigits(s: string): number {
  const digits = s.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function PayrollForm({
  storeId,
  month,
  entry,
  onDone,
}: {
  storeId: string;
  month: string;
  entry?: PayrollEntry;
  onDone: () => void;
}) {
  const action = entry ? updatePayrollEntry : savePayrollEntry;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [deleting, startDelete] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const [position, setPosition] = useState<PayrollPosition | "">(entry?.position ?? "");
  const [hourlyRate, setHourlyRate] = useState(formatDigits(entry?.hourly_rate));
  const [workHours, setWorkHours] = useState(entry?.work_hours ? String(entry.work_hours) : "");
  const isPartTimer = position === "파트타이머";
  const partTimerPay = Math.round(parseDigits(hourlyRate) * (Number(workHours) || 0));

  useEffect(() => {
    if (state?.success) onDone();
  }, [state, onDone]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-brand bg-card p-4"
    >
      <input type="hidden" name="store_id" value={storeId} />
      <input type="hidden" name="month" value={month} />
      {entry && <input type="hidden" name="id" value={entry.id} />}

      <p className="text-sm font-semibold">{entry ? "내역 수정" : "직원 추가"}</p>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          이름
          <input
            type="text"
            name="employee_name"
            required
            defaultValue={entry?.employee_name ?? ""}
            placeholder="홍길동"
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-brand/30 focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          직급
          <select
            name="position"
            value={position}
            onChange={(e) => setPosition(e.target.value as PayrollPosition | "")}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-brand/30 focus:ring-2"
          >
            <option value="">선택 안 함</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isPartTimer ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              시급
              <div className="flex items-center rounded-xl border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-brand/30">
                <input
                  type="text"
                  inputMode="numeric"
                  name="hourly_rate"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(formatDigits(parseDigits(e.target.value)))}
                  placeholder="10,030"
                  className="w-full bg-transparent py-2.5 text-right text-sm text-foreground outline-none"
                />
                <span className="ml-1 text-sm text-muted">원</span>
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              근무시간
              <div className="flex items-center rounded-xl border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-brand/30">
                <input
                  type="text"
                  inputMode="decimal"
                  name="work_hours"
                  value={workHours}
                  onChange={(e) => setWorkHours(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="80"
                  className="w-full bg-transparent py-2.5 text-right text-sm text-foreground outline-none"
                />
                <span className="ml-1 text-sm text-muted">시간</span>
              </div>
            </label>
          </div>
          <p className="rounded-lg bg-brand-light px-3 py-2 text-xs text-brand-dark">
            급여 = {formatWon(partTimerPay)}
          </p>
        </>
      ) : (
        <AmountField label="계약총급여" name="base_pay" defaultValue={entry?.base_pay} />
      )}

      <AmountField label="상여금" name="bonus" defaultValue={entry?.bonus} />
      <AmountField label="추가수당" name="extra_pay" defaultValue={entry?.extra_pay} />

      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        비고
        <input
          type="text"
          name="notes"
          defaultValue={entry?.notes ?? ""}
          placeholder="예: 연장근무 12시간"
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-brand/30 focus:ring-2"
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
            if (!confirm(`${entry.employee_name} 내역을 삭제할까요?`)) return;
            startDelete(async () => {
              await deletePayrollEntry(entry.id);
              onDone();
            });
          }}
          className="text-xs font-medium text-red-500 disabled:opacity-60"
        >
          {deleting ? "삭제 중..." : "이 내역 삭제"}
        </button>
      )}
    </form>
  );
}

function AmountField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: number;
}) {
  const [value, setValue] = useState(formatDigits(defaultValue));
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <div className="flex items-center rounded-xl border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-brand/30">
        <input
          type="text"
          inputMode="numeric"
          name={name}
          value={value}
          onChange={(e) => setValue(formatDigits(parseDigits(e.target.value)))}
          placeholder="0"
          className="w-full bg-transparent py-2.5 text-right text-sm text-foreground outline-none"
        />
        <span className="ml-1 text-sm text-muted">원</span>
      </div>
    </label>
  );
}
