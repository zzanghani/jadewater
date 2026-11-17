"use client";

import { useState, useTransition } from "react";
import { markReportChecked, setFeedbackStatus, submitStabilityFeedback } from "@/app/(app)/stability/actions";

type Report = {
  date: string;
  verdict: string;
  summary: string;
  fixed: string | null;
  todo: string | null;
  detail: string | null;
  checked_at: string | null;
  updated_at: string;
};

type Feedback = {
  id: string;
  report_date: string | null;
  body: string;
  created_at: string;
  status: string;
  reply: string | null;
  replied_at: string | null;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function dateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const cls =
    verdict === "이상"
      ? "bg-red-100 text-red-800"
      : verdict === "경고"
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{verdict}</span>;
}

// '없음'만 적힌 칸은 비워 보여준다.
function meaningful(text: string | null): string | null {
  if (!text) return null;
  const t = text.trim();
  if (!t || /^(없음|-)[.。]?$/.test(t)) return null;
  return t;
}

export default function StabilityPanel({ reports, feedback }: { reports: Report[]; feedback: Feedback[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(false);

  const latest = reports[0] ?? null;
  const older = reports.slice(1);
  const openCount = feedback.filter((f) => f.status === "open").length;

  function check(date: string) {
    setError(null);
    startTransition(async () => {
      const r = await markReportChecked(date);
      if (r?.error) setError(r.error);
    });
  }

  function send() {
    setError(null);
    setSent(false);
    const body = draft;
    startTransition(async () => {
      const r = await submitStabilityFeedback({ reportDate: latest?.date ?? null, body });
      if (r?.error) setError(r.error);
      else {
        setDraft("");
        setSent(true);
      }
    });
  }

  function toggle(id: string, status: string) {
    setError(null);
    startTransition(async () => {
      const r = await setFeedbackStatus(id, status === "done" ? "open" : "done");
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!latest ? (
        <section className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">
          아직 올라온 점검 결과가 없어요. 내일 아침 6시 점검부터 여기에 쌓입니다.
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold">{dateLabel(latest.date)}</h2>
              <VerdictBadge verdict={latest.verdict} />
            </div>
            <span className="text-xs text-muted">최근 점검</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{latest.summary}</p>

          {meaningful(latest.fixed) && (
            <div className="mt-3 rounded-xl bg-brand-light/40 px-3 py-2 text-sm">
              <p className="text-xs font-semibold text-muted">고친 것</p>
              <p className="mt-0.5 whitespace-pre-wrap">{meaningful(latest.fixed)}</p>
            </div>
          )}
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm">
            <p className="text-xs font-semibold text-amber-800">대표님이 하실 일</p>
            <p className="mt-0.5 whitespace-pre-wrap">{meaningful(latest.todo) ?? "없음"}</p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            {latest.checked_at ? (
              <span className="text-xs text-muted">✓ {timeLabel(latest.checked_at)} 확인함</span>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => check(latest.date)}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                확인했어요
              </button>
            )}
            <span className="text-xs text-muted">{timeLabel(latest.updated_at)} 점검</span>
          </div>
          {latest.detail && (
            <details className="mt-2">
              <summary className="cursor-pointer select-none text-xs text-muted">전체 보고서 펼치기</summary>
              <pre className="mt-2 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl bg-background p-3 text-[11px] leading-relaxed text-foreground">
                {latest.detail}
              </pre>
            </details>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">피드백 남기기</h2>
        <p className="mt-1 text-xs text-muted">
          고칠 점, 점검에 더 넣을 것, 궁금한 점을 편하게 적어 주세요. 다음 날 아침 점검이 읽고 반영하거나 답을 남겨요.
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="예) 리뷰 리포트에 네이버 플레이스 리뷰도 들어오게 해줘"
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted">{sent ? "보냈어요. 내일 아침 점검에서 답을 남깁니다." : ""}</span>
          <button
            type="button"
            disabled={pending || !draft.trim()}
            onClick={send}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            보내기
          </button>
        </div>
      </section>

      {feedback.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">내 피드백</h2>
            <span className="text-xs text-muted">대기 {openCount}건</span>
          </div>
          <ul className="mt-2 divide-y divide-border">
            {feedback.map((f) => (
              <li key={f.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap text-sm">{f.body}</p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggle(f.id, f.status)}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      f.status === "done" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {f.status === "done" ? "처리됨" : "대기"}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {timeLabel(f.created_at)}
                  {f.report_date ? ` · ${dateLabel(f.report_date)} 점검` : ""}
                </p>
                {f.reply && (
                  <div className="mt-2 rounded-xl bg-background px-3 py-2 text-sm">
                    <p className="text-[11px] font-semibold text-muted">답 {timeLabel(f.replied_at)}</p>
                    <p className="mt-0.5 whitespace-pre-wrap">{f.reply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {older.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">지난 점검</h2>
          <ul className="mt-2 divide-y divide-border">
            {older.map((r) => (
              <li key={r.date} className="py-2">
                <details>
                  <summary className="flex cursor-pointer select-none items-center gap-2 text-sm">
                    <span className="w-[6.5rem] shrink-0 text-xs text-muted">{dateLabel(r.date)}</span>
                    <VerdictBadge verdict={r.verdict} />
                    <span className="min-w-0 flex-1 truncate">{r.summary}</span>
                    {r.checked_at && <span className="shrink-0 text-xs text-muted">✓</span>}
                  </summary>
                  <div className="mt-2 flex flex-col gap-2 pl-1 text-sm">
                    <p className="whitespace-pre-wrap">{r.summary}</p>
                    {meaningful(r.fixed) && (
                      <p className="whitespace-pre-wrap text-muted">고친 것: {meaningful(r.fixed)}</p>
                    )}
                    {meaningful(r.todo) && (
                      <p className="whitespace-pre-wrap text-muted">할 일: {meaningful(r.todo)}</p>
                    )}
                    {!r.checked_at && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => check(r.date)}
                        className="self-start rounded-xl border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        확인했어요
                      </button>
                    )}
                    {r.detail && (
                      <details>
                        <summary className="cursor-pointer select-none text-xs text-muted">전체 보고서 펼치기</summary>
                        <pre className="mt-2 max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl bg-background p-3 text-[11px] leading-relaxed">
                          {r.detail}
                        </pre>
                      </details>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
