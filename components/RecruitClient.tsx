"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkApplicant,
  deleteCampaign,
  loadApplicants,
  saveApplicants,
  type ApplicantRow,
  type IncomingApplicant,
} from "@/app/(app)/recruit/actions";
import { extractBlogIds, type BlogMetrics } from "@/lib/blogCheck";
import { buildBookmarklet, REVIEWNOTE_ORIGINS } from "@/lib/reviewnoteBookmarklet";

type StoreOption = { id: string; name: string; keywords: string[] };
type Incoming = { campaign: { id: string; title: string | null }; applicants: IncomingApplicant[] };

const fmt = (n: number | null | undefined) => (n == null ? "-" : n.toLocaleString("ko-KR"));
const pct = (x: number | null | undefined) => (x == null ? "-" : `${Math.round(x * 100)}%`);
const GRADE_STYLE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700",
  B: "bg-amber-100 text-amber-700",
  C: "bg-red-100 text-red-600",
};

function todayKey() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export default function RecruitClient({ stores, defaultStoreId }: { stores: StoreOption[]; defaultStoreId: string }) {
  const [storeId, setStoreId] = useState(defaultStoreId || stores[0]?.id || "");
  const [rows, setRows] = useState<ApplicantRow[] | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [gradeFilter, setGradeFilter] = useState<"all" | "A" | "B" | "C">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const bookmarkRef = useRef<HTMLAnchorElement>(null);
  const storeIdRef = useRef(storeId);

  // React는 javascript: 주소를 href에 못 넣게 막아서 직접 붙인다.
  useEffect(() => {
    bookmarkRef.current?.setAttribute("href", buildBookmarklet(window.location.origin));
  }, [showGuide]);

  useEffect(() => {
    let alive = true;
    loadApplicants(storeId).then((r) => {
      if (!alive) return;
      if (!r.ok) return setErr(r.error);
      setErr(null);
      setRows(r.rows);
      setCampaignId(r.rows[0]?.campaign_id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [storeId]);

  async function runChecks(targetStoreId: string, ids: string[]) {
    const queue = [...ids];
    setChecking((s) => new Set([...s, ...ids]));
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()!;
        const r = await checkApplicant(targetStoreId, id).catch(() => null);
        if (r?.ok && storeIdRef.current === targetStoreId) {
          setRows((prev) => (prev ?? []).map((x) => (x.id === id ? r.row : x)));
        }
        setChecking((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  async function importApplicants(data: Incoming, targetStoreId: string) {
    setMsg(null);
    setErr(null);
    const r = await saveApplicants(targetStoreId, data.campaign, data.applicants);
    if (!r.ok) return setErr(r.error);
    if (targetStoreId !== storeIdRef.current) setStoreId(targetStoreId);
    const fresh = await loadApplicants(targetStoreId);
    if (fresh.ok) setRows(fresh.rows);
    setCampaignId(data.campaign.id);
    setMsg(`${r.rows.length}명을 가져왔어요. 블로그를 하나씩 확인하는 중이에요.`);
    await runChecks(targetStoreId, r.rows.map((x) => x.id));
    setMsg(`${r.rows.length}명 확인을 마쳤어요.`);
  }

  // 리뷰노트 북마크 버튼이 보내는 지원자 목록 받기.
  const importRef = useRef(importApplicants);
  useEffect(() => {
    storeIdRef.current = storeId;
    importRef.current = importApplicants;
  });
  useEffect(() => {
    const handledRef = { current: null as string | null };
    function onMessage(e: MessageEvent) {
      if (!REVIEWNOTE_ORIGINS.includes(e.origin)) return;
      const d = e.data as (Incoming & { type?: string }) | null;
      if (!d || d.type !== "reviewnote-applicants" || !Array.isArray(d.applicants)) return;
      (e.source as Window | null)?.postMessage("reviewnote-ack", e.origin);
      if (handledRef.current === d.campaign.id) return; // 같은 목록이 여러 번 와도 한 번만
      handledRef.current = d.campaign.id;
      // 캠페인 이름(예: "제이드앤워터 옥수점")으로 매장을 고른다. 못 고르면 지금 매장.
      const title = d.campaign.title ?? "";
      const matched = stores.filter((s) => s.keywords.some((k) => k && title.includes(k)) || title.includes(s.name));
      const target = matched.length === 1 ? matched[0].id : storeIdRef.current;
      importRef.current(d, target);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [stores]);

  function importPasted() {
    const ids = extractBlogIds(paste);
    if (ids.length === 0) return setErr("네이버 블로그 주소(blog.naver.com/...)를 찾지 못했어요.");
    const id = `manual-${todayKey()}`;
    importApplicants(
      { campaign: { id, title: `직접 입력 ${todayKey().slice(4, 6)}/${todayKey().slice(6)}` }, applicants: ids.map((blogId) => ({ blogId })) },
      storeId
    );
    setPaste("");
  }

  const campaigns = useMemo(() => {
    const map = new Map<string, { id: string; title: string | null; at: string; count: number }>();
    for (const r of rows ?? []) {
      const c = map.get(r.campaign_id);
      if (c) c.count++;
      else map.set(r.campaign_id, { id: r.campaign_id, title: r.campaign_title, at: r.created_at, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.at.localeCompare(a.at));
  }, [rows]);

  const list = useMemo(() => {
    const inCampaign = (rows ?? []).filter((r) => r.campaign_id === campaignId);
    return inCampaign.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [rows, campaignId]);
  const counts = { A: 0, B: 0, C: 0 } as Record<string, number>;
  for (const r of list) if (r.grade) counts[r.grade]++;
  const shown = gradeFilter === "all" ? list : list.filter((r) => r.grade === gradeFilter);
  // 다른 회차에도 지원했던 블로그 (같은 매장)
  const seenBefore = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.campaign_id !== campaignId) m.set(r.blog_id, (m.get(r.blog_id) ?? 0) + 1);
    return m;
  }, [rows, campaignId]);

  async function copyNames() {
    const names = list.filter((r) => r.grade === "A").map((r) => `${r.applicant_name ?? ""} (${r.blog_id})`.trim());
    await navigator.clipboard.writeText(names.join("\n"));
    setMsg(`A등급 ${names.length}명 이름을 복사했어요.`);
  }

  async function removeCampaign() {
    if (!campaignId || !window.confirm("이 회차 검증 결과를 지울까요?")) return;
    const r = await deleteCampaign(storeId, campaignId);
    if (!r.ok) return setErr(r.error ?? "삭제하지 못했어요.");
    setRows((prev) => (prev ?? []).filter((x) => x.campaign_id !== campaignId));
    setCampaignId(campaigns.find((c) => c.id !== campaignId)?.id ?? null);
  }

  return (
    <div className="flex flex-col gap-4">
      {stores.length > 1 && (
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {/* 가져오기 */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">지원자 가져오기</h2>
          <button onClick={() => setShowGuide((v) => !v)} className="text-xs text-brand">
            {showGuide ? "접기" : "리뷰노트에서 바로 가져오기"}
          </button>
        </div>
        {showGuide && (
          <div className="mt-3 rounded-xl bg-brand-light/60 p-3 text-xs leading-relaxed text-foreground">
            <p className="font-semibold">처음 한 번만 (PC 크롬)</p>
            <p className="mt-1">
              아래 버튼을 브라우저 위쪽 <b>즐겨찾기 막대로 끌어다 놓으세요.</b>
            </p>
            <a
              ref={bookmarkRef}
              onClick={(e) => {
                e.preventDefault();
                setMsg("이 버튼은 여기서 누르는 게 아니라, 즐겨찾기 막대로 끌어다 놓은 뒤 리뷰노트 화면에서 눌러요.");
              }}
              className="mt-2 inline-block cursor-grab rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white"
            >
              체험단 검증 보내기
            </a>
            <p className="mt-3 font-semibold">모집할 때마다</p>
            <p className="mt-1">리뷰노트 → 체험단 관리 → 이번 캠페인을 연 화면에서 즐겨찾기의 <b>체험단 검증 보내기</b>를 누르면, 이 화면이 새 창으로 열리면서 지원자 전원을 자동으로 확인해요.</p>
            <p className="mt-2 text-muted">연락처·주소는 가져오지 않고 이름·블로그·리뷰노트 점수만 가져와요.</p>
            <div>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(buildBookmarklet(window.location.origin));
                  setMsg("버튼 코드를 복사했어요. 즐겨찾기를 새로 만들고 주소 칸에 붙여넣으세요.");
                }}
                className="mt-2 text-[11px] text-muted underline"
              >
                끌어다 놓기가 안 되면: 버튼 코드 복사
              </button>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">또는 블로그 주소를 붙여넣기 (여러 명 한 번에, 다른 글자가 섞여도 괜찮아요)</p>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={3}
          placeholder={"https://blog.naver.com/abcd\nhttps://blog.naver.com/efgh"}
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={importPasted}
          disabled={!paste.trim()}
          className="mt-2 w-full rounded-xl bg-brand py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          확인 시작
        </button>
      </section>

      {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
      {msg && <p className="rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-dark">{msg}</p>}

      {rows === null ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">불러오는 중...</p>
      ) : campaigns.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">아직 확인한 지원자가 없어요.</p>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {campaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => setCampaignId(c.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                  c.id === campaignId ? "border-brand bg-brand text-white" : "border-border bg-card text-foreground"
                }`}
              >
                {new Date(c.at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" })} {c.title ?? c.id} · {c.count}명
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(["all", "A", "B", "C"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGradeFilter(g)}
                  className={`rounded-full px-3 py-1 ${gradeFilter === g ? "bg-foreground text-background" : "bg-background text-foreground"}`}
                >
                  {g === "all" ? `전체 ${list.length}` : `${g} ${counts[g]}`}
                </button>
              ))}
              {checking.size > 0 && <span className="text-muted">확인 중 {checking.size}명 남음…</span>}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              A 80점↑ 추천 · B 60점↑ 고려 · C 비추천. 맛집 비중 30 · 검색 노출 35 · 협찬 과다 15 · 방문자·활동 20, 리뷰노트 페널티·취소는 감점.
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={copyNames} className="flex-1 rounded-xl border border-border py-2 text-xs">
                A등급 이름 복사
              </button>
              <button
                onClick={() => runChecks(storeId, list.map((r) => r.id))}
                disabled={checking.size > 0}
                className="flex-1 rounded-xl border border-border py-2 text-xs disabled:opacity-40"
              >
                전체 다시 확인
              </button>
              <button onClick={removeCampaign} className="rounded-xl border border-border px-3 py-2 text-xs text-red-600">
                삭제
              </button>
            </div>
          </div>

          <ul className="flex flex-col gap-2">
            {shown.map((r, i) => {
              const m = r.metrics as BlogMetrics | null;
              const isChecking = checking.has(r.id);
              const before = seenBefore.get(r.blog_id);
              return (
                <li key={r.id} className="rounded-2xl border border-border bg-card p-3">
                  <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-start gap-3 text-left">
                    <span className="w-5 shrink-0 pt-0.5 text-xs text-muted">{gradeFilter === "all" ? i + 1 : ""}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{r.applicant_name ?? r.blog_id}</span>
                        {r.applicant_name && <span className="truncate text-xs text-muted">{r.blog_id}</span>}
                      </div>
                      {m ? (
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                          맛집 {pct(m.foodRatio)} · 검색 {m.searchChecked ? `${m.searchExposed}/${m.searchChecked}` : "-"} · 협찬 {pct(m.sponsoredRatio)} · 방문자{" "}
                          {fmt((r.rn as { avgVisit?: number } | null)?.avgVisit ?? m.dayVisitors)} · 이웃 {fmt(m.subscribers)} · 30일 글 {m.posts30d}
                          {m.directory ? ` · ${m.directory}` : ""}
                          {(r.rn as { exposureScore?: number } | null)?.exposureScore != null && ` · 리뷰노트 ${(r.rn as { exposureScore: number }).exposureScore}`}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted">{isChecking ? "확인 중…" : "아직 확인 전"}</p>
                      )}
                      {(r.flags.length > 0 || before) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {r.flags.map((f) => (
                            <span key={f} className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600">
                              {f}
                            </span>
                          ))}
                          {before && <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">이전 회차에도 지원 {before}회</span>}
                        </div>
                      )}
                    </div>
                    {r.grade ? (
                      <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${GRADE_STYLE[r.grade] ?? ""}`}>
                        {r.grade} {r.score}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted">{isChecking ? "…" : ""}</span>
                    )}
                  </button>
                  {open === r.id && (
                    <div className="mt-3 border-t border-border pt-3 text-xs">
                      <a href={`https://blog.naver.com/${r.blog_id}`} target="_blank" rel="noreferrer" className="text-brand underline">
                        블로그 열기{m?.blogName ? ` · ${m.blogName}` : ""}
                      </a>
                      {m?.error && <p className="mt-2 text-red-600">{m.error}</p>}
                      {m && m.samplePosts.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {m.samplePosts.map((p) => (
                            <li key={p.url} className="flex items-start gap-1.5">
                              <span className="shrink-0 text-[10px] text-muted">
                                {p.food ? "🍽" : "·"}
                                {p.sponsored ? " 협찬" : ""}
                                {p.exposed === true ? " 검색✓" : p.exposed === false ? " 검색✗" : ""}
                              </span>
                              <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-foreground underline-offset-2 hover:underline">
                                {p.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-2 text-[10px] text-muted">
                        최근 글 {m?.postsChecked ?? 0}개 기준 · 마지막 글 {m?.lastPostDays != null ? `${m.lastPostDays}일 전` : "-"}
                        {r.checked_at && ` · ${new Date(r.checked_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 확인`}
                      </p>
                      <button onClick={() => runChecks(storeId, [r.id])} className="mt-2 text-[11px] text-brand">
                        이 사람만 다시 확인
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
