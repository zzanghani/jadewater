"use client";

import { useState, useTransition } from "react";
import { markAdPostRead } from "@/app/(app)/ad-report/board/actions";
import { man, pct, roasPerMan, type AdDailyAllPost, type AdDailyPost, type AdFlag } from "@/lib/adDailyPost";
import { kstWeekdayShortLabel } from "@/lib/date";

export type BoardPostRow = {
  date: string;
  generatedAt: string;
  post: AdDailyPost;
  reads: { userId: string; name: string; readAt: string }[];
};
export type AllPostRow = {
  date: string;
  generatedAt: string;
  all: AdDailyAllPost;
  reads: { storeId: string; name: string; confirmed: boolean }[];
};

const SEV: Record<AdFlag["sev"], { dot: string; text: string }> = {
  bad: { dot: "bg-red-500", text: "text-red-600" },
  warn: { dot: "bg-amber-500", text: "text-amber-700" },
  good: { dot: "bg-green-500", text: "text-green-700" },
  info: { dot: "bg-gray-400", text: "text-muted" },
};

function dateLabel(d: string) {
  const [, m, dd] = d.split("-").map(Number);
  return `${m}월 ${dd}일 (${kstWeekdayShortLabel(d)})`;
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
// 변화율 꼬리표: 지난주 같은 요일 대비
function Delta({ cur, prev, goodWhenUp = true }: { cur: number | null; prev: number | null | undefined; goodWhenUp?: boolean }) {
  if (cur == null || prev == null || prev <= 0) return null;
  const d = pct(cur, prev);
  if (d == null) return null;
  const up = d > 0;
  const good = up === goodWhenUp;
  return <span className={`ml-1 text-[10px] ${d === 0 ? "text-muted" : good ? "text-green-700" : "text-red-600"}`}>{d > 0 ? "▲" : d < 0 ? "▼" : ""}{Math.abs(d)}%</span>;
}

// 성과 확인 게시판 목록: 맨 위 글은 펼쳐 두고, 나머지는 눌러서 펼친다.
// canConfirm: 자기 매장 지점장만 "확인했어요"를 누른다. showReads: 본사(대표님·마케팅팀)는 누가 확인했는지 본다.
// allRows 가 있으면(볼 수 있는 매장이 둘 이상) "전체 매장 / 매장별" 탭을 보여준다.
export default function AdDailyBoard({
  storeId,
  rows,
  allRows,
  defaultView = "store",
  currentUserId,
  canConfirm,
  showReads,
}: {
  storeId: string;
  rows: BoardPostRow[];
  allRows?: AllPostRow[] | null;
  defaultView?: "all" | "store";
  currentUserId: string;
  canConfirm: boolean;
  showReads: boolean;
}) {
  const [view, setView] = useState<"all" | "store">(allRows ? defaultView : "store");
  const [open, setOpen] = useState<string | null>((view === "all" ? allRows?.[0]?.date : rows[0]?.date) ?? null);
  const empty = (
    <section className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">아직 올라온 글이 없어요. 내일 아침 8시에 첫 글이 올라옵니다.</section>
  );
  return (
    <div className="flex flex-col gap-2">
      {allRows && (
        <div className="grid grid-cols-2 rounded-xl bg-background p-1 text-sm font-semibold">
          <button type="button" onClick={() => { setView("all"); setOpen(allRows[0]?.date ?? null); }} className={`rounded-lg py-2 ${view === "all" ? "bg-card text-foreground shadow-sm" : "text-muted"}`}>
            전체 매장
          </button>
          <button type="button" onClick={() => { setView("store"); setOpen(rows[0]?.date ?? null); }} className={`rounded-lg py-2 ${view === "store" ? "bg-card text-foreground shadow-sm" : "text-muted"}`}>
            매장별
          </button>
        </div>
      )}
      {view === "all" && allRows
        ? allRows.length
          ? allRows.map((r) => <AllPostCard key={r.date} row={r} expanded={open === r.date} onToggle={() => setOpen(open === r.date ? null : r.date)} showReads={showReads} />)
          : empty
        : rows.length
          ? rows.map((r) => (
              <PostCard key={r.date} storeId={storeId} row={r} expanded={open === r.date} onToggle={() => setOpen(open === r.date ? null : r.date)} currentUserId={currentUserId} canConfirm={canConfirm} showReads={showReads} />
            ))
          : empty}
    </div>
  );
}

// 전체 매장 합계 글: 합계 4칸 → 7일 흐름 → 매장별 표 → 급한 진단(매장 이름 붙여서) → 매장별 확인 여부.
function AllPostCard({ row, expanded, onToggle, showReads }: { row: AllPostRow; expanded: boolean; onToggle: () => void; showReads: boolean }) {
  const a = row.all;
  const yR = roasPerMan(a.y.sales, a.y.cost);
  const lwR = a.lastWeek ? roasPerMan(a.lastWeek.sales, a.lastWeek.cost) : null;
  const w7R = roasPerMan(a.w7.sales, a.w7.cost);
  const p7R = roasPerMan(a.p7.sales, a.p7.cost);
  const bad = new Set(a.flags.filter((f) => f.sev === "bad").map((f) => f.store)).size;
  const warn = new Set(a.flags.filter((f) => f.sev === "warn").map((f) => f.store)).size;
  const budgetPace = a.mtd.budget && a.mtd.budget > 0 ? Math.min(100, Math.round((a.mtd.cost / a.mtd.budget) * 100)) : null;
  const expectedPace = a.mtd.budget ? Math.round((a.mtd.day / a.mtd.monthDays) * 100) : null;
  return (
    <section className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <div className="min-w-0">
          <p className="text-sm font-bold">{dateLabel(a.date)} 전체 매장 광고 성과</p>
          <p className="mt-0.5 truncate text-[11px] text-muted">
            {a.stores.length}개 매장 · 광고비 {man(a.y.cost)} · 매출 {man(a.y.sales)}
            {bad || warn ? <span className={bad ? "ml-1 text-red-600" : "ml-1 text-amber-700"}> · 조치 {bad}곳 · 점검 {warn}곳</span> : <span className="ml-1 text-green-700"> · 급한 매장 없음</span>}
          </p>
        </div>
        <span className="shrink-0 text-muted">{expanded ? "▴" : "▾"}</span>
      </button>
      {expanded && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="어제 광고비 합계" value={man(a.y.cost)} tail={<Delta cur={a.y.cost} prev={a.lastWeek?.cost} goodWhenUp={false} />} />
            <Stat label="어제 매출 합계" value={man(a.y.sales)} tail={<Delta cur={a.y.sales} prev={a.lastWeek?.sales} />} />
            <Stat label="광고비 1만원당 매출" value={yR == null ? "-" : `${yR.toFixed(1)}만원`} tail={yR != null && lwR != null ? <Delta cur={yR} prev={lwR} /> : null} />
            <Stat label="클릭 · 클릭 한 번 값" value={`${a.y.clk.toLocaleString()}번 · ${a.y.clk ? man(Math.round(a.y.cost / a.y.clk)) : "-"}`} tail={<Delta cur={a.y.clk} prev={a.lastWeek?.clk} />} />
          </div>
          <p className="mt-1.5 text-[10px] text-muted">▲▼ 는 지난주 같은 요일과 비교 · 매출은 자료가 있는 매장만 합산</p>

          <div className="mt-3 rounded-xl bg-background px-3 py-2.5 text-[11px] tabular-nums">
            <p className="mb-1 font-semibold text-foreground">최근 7일 vs 그 전 7일 (합계)</p>
            <div className="grid grid-cols-3 gap-2">
              <Mini label="광고비" value={man(a.w7.cost)} tail={<Delta cur={a.w7.cost} prev={a.p7.cost} goodWhenUp={false} />} />
              <Mini label="매출" value={man(a.w7.sales)} tail={<Delta cur={a.w7.sales} prev={a.p7.sales} />} />
              <Mini label="1만원당 매출" value={w7R == null ? "-" : `${w7R.toFixed(1)}만원`} tail={w7R != null && p7R != null ? <Delta cur={w7R} prev={p7R} /> : null} />
            </div>
          </div>

          {budgetPace != null && expectedPace != null && (
            <div className="mt-2 rounded-xl bg-background px-3 py-2.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">이달 광고비 누적 (예산 있는 매장 합계)</span>
                <span className="tabular-nums">
                  {man(a.mtd.cost)}
                  <span className="text-muted"> / 예산 {man(a.mtd.budget)}</span>
                </span>
              </div>
              <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                <div className={`h-full rounded-full ${budgetPace > expectedPace + 10 ? "bg-red-500" : "bg-brand"}`} style={{ width: `${budgetPace}%` }} />
                <div className="absolute top-0 h-full w-0.5 bg-foreground/60" style={{ left: `${expectedPace}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-muted">{a.mtd.day}일째 · 사용 {budgetPace}% · 날짜 기준 페이스 {expectedPace}%</p>
            </div>
          )}

          {/* 매장별 표 */}
          <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-[11px] tabular-nums">
              <thead className="bg-background text-[10px] text-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">매장</th>
                  <th className="px-2 py-1.5 text-right font-medium">광고비</th>
                  <th className="px-2 py-1.5 text-right font-medium">매출</th>
                  <th className="px-2 py-1.5 text-right font-medium">1만원당</th>
                </tr>
              </thead>
              <tbody>
                {a.stores.map((s) => {
                  const r = roasPerMan(s.post.y.sales, s.post.y.cost);
                  const short = s.name.replace(/^(제이드앤워터|정다미)\s*/, "");
                  return (
                    <tr key={s.storeId} className="border-t border-border/60">
                      <td className="px-2 py-1.5">
                        <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${SEV[s.worst].dot}`} />
                        {short}
                        {showReads && (
                          <span className={`ml-1 text-[10px] ${row.reads.find((x) => x.storeId === s.storeId)?.confirmed ? "text-green-700" : "text-muted"}`}>
                            {row.reads.find((x) => x.storeId === s.storeId)?.confirmed ? "확인" : "미확인"}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {s.post.adConnected ? man(s.post.y.cost) : "-"}
                        <Delta cur={s.post.y.cost} prev={s.post.lastWeek?.cost} goodWhenUp={false} />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {man(s.post.y.sales)}
                        <Delta cur={s.post.y.sales} prev={s.post.lastWeek?.sales} />
                      </td>
                      <td className="px-2 py-1.5 text-right">{r == null ? "-" : `${r.toFixed(1)}만`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {a.flags.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {a.flags.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEV[f.sev].dot}`} />
                  <span className={SEV[f.sev].text}>
                    <span className="font-semibold">{f.store.replace(/^(제이드앤워터|정다미)\s*/, "")}</span> · {f.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-green-700">급한 매장이 없어요. 매장별 탭에서 각 매장의 자세한 진단과 AI 한마디를 볼 수 있어요.</p>
          )}
          <p className="mt-3 text-[10px] text-muted">{timeLabel(row.generatedAt)} 자동 게시 · 매장별 AI 한마디는 매장별 탭에서</p>
        </div>
      )}
    </section>
  );
}

function PostCard({ storeId, row, expanded, onToggle, currentUserId, canConfirm, showReads }: { storeId: string; row: BoardPostRow; expanded: boolean; onToggle: () => void; currentUserId: string; canConfirm: boolean; showReads: boolean }) {
  const p = row.post;
  const [reads, setReads] = useState(row.reads);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const mine = reads.some((x) => x.userId === currentUserId);
  const worst = p.flags.find((f) => f.sev === "bad") ?? p.flags.find((f) => f.sev === "warn") ?? p.flags[0];
  const yR = roasPerMan(p.y.sales, p.y.cost);
  const lwR = p.lastWeek ? roasPerMan(p.lastWeek.sales, p.lastWeek.cost) : null;
  const w7R = roasPerMan(p.w7.sales, p.w7.cost);
  const p7R = roasPerMan(p.p7.sales, p.p7.cost);
  const budgetPace = p.mtd.budget && p.mtd.budget > 0 ? Math.min(100, Math.round((p.mtd.cost / p.mtd.budget) * 100)) : null;
  const expectedPace = p.mtd.budget ? Math.round((p.mtd.day / p.mtd.monthDays) * 100) : null;

  function confirm() {
    setErr(null);
    start(async () => {
      const r = await markAdPostRead(storeId, p.date);
      if (!r.ok) setErr(r.error);
      else setReads((prev) => (prev.some((x) => x.userId === currentUserId) ? prev : [...prev, { userId: currentUserId, name: "나", readAt: new Date().toISOString() }]));
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <div className="min-w-0">
          <p className="text-sm font-bold">{dateLabel(p.date)} 광고 성과</p>
          {!expanded && worst && (
            <p className={`mt-0.5 truncate text-[11px] ${SEV[worst.sev].text}`}>{worst.text}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mine && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">확인함</span>}
          {!mine && canConfirm && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">미확인</span>}
          {showReads && reads.length > 0 && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">점장 확인</span>}
          <span className="text-muted">{expanded ? "▴" : "▾"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3">
          {/* 핵심 숫자 4개 */}
          <div className="grid grid-cols-2 gap-2">
            <Stat label="어제 광고비" value={p.adConnected ? man(p.y.cost) : "-"} tail={<Delta cur={p.y.cost} prev={p.lastWeek?.cost} goodWhenUp={false} />} />
            <Stat label={p.salesSource === "toss" ? "어제 매출 (토스)" : "어제 매출 (마감)"} value={man(p.y.sales)} tail={<Delta cur={p.y.sales} prev={p.lastWeek?.sales} />} />
            <Stat label="광고비 1만원당 매출" value={yR == null ? "-" : `${yR.toFixed(1)}만원`} tail={yR != null && lwR != null ? <Delta cur={yR} prev={lwR} /> : null} />
            <Stat label="클릭 · 클릭 한 번 값" value={p.adConnected ? `${p.y.clk.toLocaleString()}번 · ${p.y.clk ? man(Math.round(p.y.cost / p.y.clk)) : "-"}` : "-"} tail={<Delta cur={p.y.clk} prev={p.lastWeek?.clk} />} />
          </div>
          <p className="mt-1.5 text-[10px] text-muted">▲▼ 는 지난주 같은 요일과 비교</p>

          {/* 7일 흐름 */}
          <div className="mt-3 rounded-xl bg-background px-3 py-2.5 text-[11px] tabular-nums">
            <p className="mb-1 font-semibold text-foreground">최근 7일 vs 그 전 7일</p>
            <div className="grid grid-cols-3 gap-2">
              <Mini label="광고비" value={man(p.w7.cost)} tail={<Delta cur={p.w7.cost} prev={p.p7.cost} goodWhenUp={false} />} />
              <Mini label="매출" value={man(p.w7.sales)} tail={<Delta cur={p.w7.sales} prev={p.p7.sales} />} />
              <Mini label="1만원당 매출" value={w7R == null ? "-" : `${w7R.toFixed(1)}만원`} tail={w7R != null && p7R != null ? <Delta cur={w7R} prev={p7R} /> : null} />
            </div>
          </div>

          {/* 이달 예산 페이스 */}
          {p.adConnected && (
            <div className="mt-2 rounded-xl bg-background px-3 py-2.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">이달 광고비 누적</span>
                <span className="tabular-nums">
                  {man(p.mtd.cost)}
                  {p.mtd.budget ? <span className="text-muted"> / 예산 {man(p.mtd.budget)}</span> : <span className="text-muted"> · 월 예산 미설정</span>}
                </span>
              </div>
              {budgetPace != null && expectedPace != null && (
                <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                  <div className={`h-full rounded-full ${budgetPace > expectedPace + 10 ? "bg-red-500" : "bg-brand"}`} style={{ width: `${budgetPace}%` }} />
                  <div className="absolute top-0 h-full w-0.5 bg-foreground/60" style={{ left: `${expectedPace}%` }} title="오늘 기준 예산 페이스" />
                </div>
              )}
              {budgetPace != null && expectedPace != null && (
                <p className="mt-1 text-[10px] text-muted">
                  {p.mtd.day}일째 · 사용 {budgetPace}% · 날짜 기준 페이스 {expectedPace}%
                </p>
              )}
            </div>
          )}

          {/* 진단 */}
          <ul className="mt-3 flex flex-col gap-1.5">
            {p.flags.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEV[f.sev].dot}`} />
                <span className={SEV[f.sev].text}>{f.text}</span>
              </li>
            ))}
          </ul>

          {/* AI 한마디 */}
          {p.comment && (
            <div className="mt-3 rounded-xl border border-brand-light bg-brand-light/60 px-3 py-2.5 text-xs leading-relaxed text-brand-dark">
              <p className="mb-1 text-[10px] font-semibold">오늘의 한마디</p>
              {p.comment}
            </div>
          )}

          {/* 확인 */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted">{timeLabel(row.generatedAt)} 자동 게시</span>
            {showReads ? (
              <span className="text-[11px] text-muted">
                {reads.length ? `확인: ${reads.map((r) => `${r.name} ${timeLabel(r.readAt).split(" ").slice(-2).join(" ")}`).join(", ")}` : "점장 아직 미확인"}
              </span>
            ) : mine ? (
              <span className="text-[11px] font-semibold text-green-700">확인했어요 ✓</span>
            ) : canConfirm ? (
              <button type="button" onClick={confirm} disabled={pending} className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                {pending ? "저장 중..." : "확인했어요"}
              </button>
            ) : (
              <span className="text-[11px] text-muted">{reads.length ? "점장 확인함" : "점장 미확인"}</span>
            )}
          </div>
          {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, tail }: { label: string; value: string; tail?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-background px-3 py-2">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="text-sm font-bold tabular-nums">
        {value}
        {tail}
      </p>
    </div>
  );
}
function Mini({ label, value, tail }: { label: string; value: string; tail?: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <p className="font-semibold">
        {value}
        {tail}
      </p>
    </div>
  );
}
