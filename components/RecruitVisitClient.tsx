"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { updateVisit, type ApplicantRow, type VisitPatch } from "@/app/(app)/recruit/actions";
import type { RecruitRound } from "@/lib/types";
import MacminiNote from "@/components/MacminiNote";

// 선정 이후 흐름: 방문 예약 → 방문 완료 → 리뷰 등록(리뷰노트에서 맥미니가 읽어옴).
// 점장이 하는 일은 "방문 일시 잡기"와 "왔다/안 왔다 체크" 둘뿐이다.

type Stage = "unscheduled" | "scheduled" | "overdue" | "visited" | "reviewed" | "no_show";

function stageOf(r: ApplicantRow, nowMs: number): Stage {
  if (r.no_show) return "no_show";
  if (r.review_url) return "reviewed";
  if (r.visited_at) return "visited";
  if (r.visit_at) return new Date(r.visit_at).getTime() < nowMs ? "overdue" : "scheduled";
  return "unscheduled";
}

const STAGE_LABEL: Record<Stage, string> = {
  unscheduled: "예약 전",
  scheduled: "방문 예정",
  overdue: "방문 확인 필요",
  visited: "방문 완료 · 리뷰 대기",
  reviewed: "리뷰 등록 ✓",
  no_show: "노쇼",
};
const STAGE_STYLE: Record<Stage, string> = {
  unscheduled: "bg-gray-100 text-gray-600",
  scheduled: "bg-sky-50 text-sky-700",
  overdue: "bg-amber-50 text-amber-700",
  visited: "bg-brand-light text-brand-dark",
  reviewed: "bg-emerald-100 text-emerald-700",
  no_show: "bg-red-50 text-red-600",
};
const STAGE_ORDER: Stage[] = ["overdue", "scheduled", "unscheduled", "visited", "reviewed", "no_show"];

const KST = "Asia/Seoul";
function kstParts(iso: string) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${String(Number(g("hour")) % 24).padStart(2, "0")}:${g("minute")}` };
}
// ISO → <input type=datetime-local> 값(KST)
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const { date, time } = kstParts(iso);
  return `${date}T${time}`;
}
// datetime-local 값(KST) → ISO
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(`${v}:00+09:00`).toISOString();
}
function visitLabel(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: KST, month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}
function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function RecruitVisitClient({
  storeId,
  round,
  rows,
  onUpdated,
}: {
  storeId: string;
  round: RecruitRound | null;
  /** 이 캠페인의 선정자만 */
  rows: ApplicantRow[];
  onUpdated: (row: ApplicantRow) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // 화면이 열린 시각 기준으로 "예정/지남"을 가른다 (렌더 중 시계를 읽지 않도록 한 번만).
  const [nowMs] = useState(() => Date.now());

  const staged = useMemo(() => {
    const withStage = rows.map((r) => ({ r, stage: stageOf(r, nowMs) }));
    return withStage.sort((a, b) => {
      const d = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
      if (d !== 0) return d;
      const av = a.r.visit_at ? new Date(a.r.visit_at).getTime() : Infinity;
      const bv = b.r.visit_at ? new Date(b.r.visit_at).getTime() : Infinity;
      return av - bv;
    });
  }, [rows, nowMs]);

  const count = (s: Stage) => staged.filter((x) => x.stage === s).length;
  const dLeft = daysLeft(round?.review_end_at ?? null);

  async function save(id: string, patch: VisitPatch) {
    setBusy(id);
    setErr(null);
    const r = await updateVisit(storeId, id, patch);
    setBusy(null);
    if (!r.ok) return setErr(r.error);
    onUpdated(r.row);
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">
        아직 선정된 사람이 없어요. 지원자·선정 탭에서 선정 승인을 하면 여기서 방문·리뷰를 관리해요.
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      {/* 요약 */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">체험 진행 · 선정 {rows.length}명</span>
          {dLeft !== null && (
            <span className={`text-xs font-semibold ${dLeft < 0 ? "text-muted" : dLeft <= 3 ? "text-red-600" : "text-brand"}`}>
              {dLeft < 0 ? "리뷰 마감 지남" : dLeft === 0 ? "리뷰 마감 오늘" : `리뷰 마감 D-${dLeft}`}
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px]">
          {(["unscheduled", "scheduled", "visited", "reviewed", "no_show"] as Stage[]).map((s) => (
            <div key={s} className="rounded-lg bg-background px-1 py-1.5">
              <p className="text-muted">{s === "unscheduled" ? "예약 전" : s === "scheduled" ? "예약됨" : s === "visited" ? "방문" : s === "reviewed" ? "리뷰" : "노쇼"}</p>
              <p className="text-sm font-bold">{s === "scheduled" ? count("scheduled") + count("overdue") : count(s)}</p>
            </div>
          ))}
        </div>
        {round && <MacminiNote note={round.macmini_note} at={round.macmini_at} />}
        <p className="mt-1 text-[11px] text-muted">리뷰 등록 여부는 맥미니가 30분마다 리뷰노트에서 확인해요. 방문 예약·완료만 여기서 적어주세요.</p>
        <p className="mt-1 text-[11px] text-amber-700">방문 당일: 손님의 네이버 블로그 앱(로그인 화면) 또는 리뷰노트 앱 &lsquo;선정 내역&rsquo;으로 본인 확인 후 방문 완료를 눌러 주세요.</p>
        {round?.booking_token && (
          <BookingLinkCard token={round.booking_token} />
        )}
      </div>

      {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}

      <ul className="flex flex-col gap-2">
        {staged.map(({ r, stage }) => {
          const isOpen = open === r.id;
          const ranks = r.review_ranks ?? null;
          const rankText = ranks
            ? Object.values(ranks)
                .filter((v): v is number => typeof v === "number")
                .map((v) => `${v}위`)
                .join(" · ")
            : "";
          return (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-3">
              <button onClick={() => setOpen(isOpen ? null : r.id)} className="flex w-full items-start gap-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{r.applicant_name ?? r.blog_id}</span>
                    {r.applicant_name && <span className="truncate text-xs text-muted">{r.blog_id}</span>}
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    {r.visit_at ? `${visitLabel(r.visit_at)}${r.visit_party ? ` · ${r.visit_party}명` : ""}` : "방문 일시 미정"}
                    {r.visit_at && r.visit_source === "reviewer" && <span className="ml-1 rounded-md bg-violet-50 px-1 py-0.5 text-[10px] font-semibold text-violet-700">본인 예약</span>}
                    {r.visit_contact && ` · ${r.visit_contact}`}
                    {r.visit_note && ` · ${r.visit_note}`}
                    {r.visited_at && ` · 방문 ${kstParts(r.visited_at).date.slice(5).replace("-", "/")}`}
                    {rankText && ` · 검색 ${rankText}`}
                  </p>
                </div>
                <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold ${STAGE_STYLE[stage]}`}>{STAGE_LABEL[stage]}</span>
              </button>

              {isOpen && (
                <VisitEditor
                  row={r}
                  stage={stage}
                  busy={busy === r.id}
                  onSave={(patch) => save(r.id, patch)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function VisitEditor({
  row,
  stage,
  busy,
  onSave,
}: {
  row: ApplicantRow;
  stage: Stage;
  busy: boolean;
  onSave: (patch: VisitPatch) => void;
}) {
  const [when, setWhen] = useState(toLocalInput(row.visit_at));
  const [party, setParty] = useState(row.visit_party ? String(row.visit_party) : "");
  const [note, setNote] = useState(row.visit_note ?? "");
  const dirty = when !== toLocalInput(row.visit_at) || party !== (row.visit_party ? String(row.visit_party) : "") || note !== (row.visit_note ?? "");

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 text-xs">
      <div className="grid grid-cols-[1fr_72px] gap-2">
        <label className="flex flex-col gap-1 text-muted">
          방문 일시
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-xl border border-border bg-background px-2 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-muted">
          인원
          <input
            type="number"
            min={1}
            max={20}
            inputMode="numeric"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            className="rounded-xl border border-border bg-background px-2 py-2 text-sm text-foreground"
          />
        </label>
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="메모 (예: 아기의자 요청, 창가 자리)"
        className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ visit_at: fromLocalInput(when), visit_party: party ? Number(party) : null, visit_note: note })}
          disabled={busy || !dirty}
          className="flex-1 rounded-xl bg-brand py-2 font-semibold text-white disabled:opacity-40"
        >
          예약 저장
        </button>
        {stage === "visited" || stage === "reviewed" ? (
          <button onClick={() => onSave({ visited: false })} disabled={busy} className="flex-1 rounded-xl border border-border py-2 disabled:opacity-40">
            방문 완료 취소
          </button>
        ) : (
          <button onClick={() => onSave({ visited: true })} disabled={busy} className="flex-1 rounded-xl border border-brand bg-brand-light py-2 font-semibold text-brand disabled:opacity-40">
            방문 완료 ✓
          </button>
        )}
        {stage === "no_show" ? (
          <button onClick={() => onSave({ no_show: false })} disabled={busy} className="rounded-xl border border-border px-3 py-2 disabled:opacity-40">
            노쇼 취소
          </button>
        ) : (
          stage !== "reviewed" && (
            <button onClick={() => onSave({ no_show: true })} disabled={busy} className="rounded-xl border border-border px-3 py-2 text-red-600 disabled:opacity-40">
              노쇼
            </button>
          )
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px]">
        <a href={`https://blog.naver.com/${row.blog_id}`} target="_blank" rel="noreferrer" className="text-brand underline">
          블로그 열기
        </a>
        {row.review_url && (
          <a href={row.review_url} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
            리뷰 보기{row.review_at ? ` · ${kstParts(row.review_at).date.slice(5).replace("-", "/")} 등록` : ""}
          </a>
        )}
        {row.rn_status && <span className="text-muted">리뷰노트 {row.rn_status}</span>}
      </div>
    </div>
  );
}

// 선정자용 예약 링크 — 주소를 그대로 보여주고, 복사(클립보드 → 안 되면 선택해서 복사)와
// 공유(폰의 공유 시트: 카카오톡 등)를 둔다. 앱(PWA)·인앱 브라우저에선 클립보드 API가
// 막히는 경우가 있어 조용히 실패하지 않게 한다.
function BookingLinkCard({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  // 서버 렌더 땐 주소를 모르니 빈 값, 브라우저에선 현재 주소(그린/블루에 따라 다름).
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
  const url = origin ? `${origin}/visit/${token}` : "";
  const canShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false
  );

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error("no clipboard api");
      }
      setState("copied");
    } catch {
      // 구형/인앱 브라우저: 숨은 입력칸을 선택해서 복사 명령
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      setState(ok ? "copied" : "failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  async function share() {
    try {
      await navigator.share({ title: "체험단 방문 예약", text: "선정되신 분은 아래 링크에서 방문 일정을 예약해 주세요.", url });
    } catch {
      /* 사용자가 취소 */
    }
  }

  return (
    <div className="mt-3 rounded-xl bg-background p-3">
      <p className="text-xs font-semibold">선정자가 직접 예약하게 하기</p>
      <p className="mt-1 text-[11px] text-muted">아래 링크를 리뷰노트 선정 안내(또는 쪽지)에 붙여 넣으세요. 블로거가 날짜·시간·인원을 적으면 여기 자동으로 들어오고, 지점장에게 알림이 와요.</p>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-2 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] text-foreground"
        aria-label="예약 링크"
      />
      <div className="mt-2 flex gap-2">
        <button onClick={copy} className="flex-1 rounded-xl border border-brand bg-brand-light py-2 text-xs font-semibold text-brand">
          {state === "copied" ? "복사됨 ✓" : state === "failed" ? "위 칸을 길게 눌러 복사하세요" : "링크 복사"}
        </button>
        {canShare && (
          <button onClick={share} className="flex-1 rounded-xl bg-brand py-2 text-xs font-semibold text-white">
            카톡 등으로 공유
          </button>
        )}
      </div>
    </div>
  );
}
