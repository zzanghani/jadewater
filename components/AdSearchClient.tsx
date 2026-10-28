"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addAdKeyword,
  checkSearchNow,
  comboSearch,
  findKeywords,
  loadAdKeywords,
  loadSearchInfo,
  removeAdKeyword,
  saveSearchSettings,
  toggleAdKeyword,
  type AdKeywordGroup,
  type ComboRow,
  type SearchInfo,
} from "@/app/(app)/ad-report/insight/actions";
import type { KeywordIdea } from "@/lib/naverAds";

const norm = (k: string) => k.replace(/\s+/g, "").toLowerCase();
const fmt = (n: number | null | undefined) => (n == null ? "-" : n.toLocaleString("ko-KR"));

export default function AdSearchClient({ storeId }: { storeId: string }) {
  const [info, setInfo] = useState<SearchInfo | null>(null);
  const [groups, setGroups] = useState<AdKeywordGroup[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, start] = useTransition();
  const [tab, setTab] = useState<"track" | "find" | "combo" | "ad">("track");
  const [msg, setMsg] = useState<string | null>(null);

  const reload = () =>
    start(async () => {
      const [r, g] = await Promise.all([loadSearchInfo(storeId), loadAdKeywords(storeId)]);
      if (r.ok) setInfo(r.search);
      else setErr(r.error);
      if (g.ok) setGroups(g.groups);
    });
  useEffect(() => {
    start(async () => {
      const [r, g] = await Promise.all([loadSearchInfo(storeId), loadAdKeywords(storeId)]);
      if (r.ok) setInfo(r.search);
      else setErr(r.error);
      if (g.ok) setGroups(g.groups);
    });
  }, [storeId]);

  if (err) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>;
  if (!info) return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">{loading ? "불러오는 중..." : ""}</p>;

  const registered = new Set((groups ?? []).flatMap((g) => g.keywords.map((k) => norm(k.keyword))));
  const tracked = new Set(info.keywords.map(norm));

  // 추적에 추가 (설정 저장)
  function addTrack(kw: string) {
    setMsg(null);
    if (tracked.has(norm(kw))) return setMsg(`'${kw}'은(는) 이미 추적 중이에요.`);
    if (info!.keywords.length >= 10) return setMsg("추적 키워드는 10개까지예요. 설정에서 하나 빼고 넣어 주세요.");
    start(async () => {
      const r = await saveSearchSettings(storeId, info!.terms.join(", "), [...info!.keywords, kw].join(", "));
      if (!r.ok) return setMsg(r.error);
      setMsg(`'${kw}' 추적에 넣었어요. 다음 새벽부터 확인돼요 (지금 확인도 가능).`);
      reload();
    });
  }
  // 광고 키워드로 추가
  function addAd(kw: string, adgroupId: string, adgroupName: string) {
    setMsg(null);
    if (!window.confirm(`'${kw}'을(를) 광고그룹 '${adgroupName}'에 추가할까요?\n그룹 입찰가로 바로 광고가 나가요.`)) return;
    start(async () => {
      const r = await addAdKeyword(storeId, adgroupId, adgroupName, kw);
      if (!r.ok) return setMsg(r.error);
      setMsg(`'${kw}' 광고 키워드로 추가했어요.`);
      reload();
    });
  }

  const TABS = [
    ["track", "추적"],
    ["find", "연관 키워드"],
    ["combo", "조합 검색"],
    ["ad", `광고 키워드${groups ? ` ${groups.reduce((n, g) => n + g.keywords.length, 0)}` : ""}`],
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 rounded-xl bg-background p-1 text-xs font-semibold">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg py-2 ${tab === k ? "bg-card text-foreground shadow-sm" : "text-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      {msg && <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">{msg}</p>}
      {tab === "track" && <TrackPanel key={`${info.terms.join("|")}#${info.keywords.join("|")}`} storeId={storeId} search={info} onChanged={reload} />}
      {tab === "find" && <FindPanel storeId={storeId} adConnected={info.adConnected} groups={groups ?? []} registered={registered} tracked={tracked} onTrack={addTrack} onAd={addAd} />}
      {tab === "combo" && <ComboPanel storeId={storeId} adConnected={info.adConnected} groups={groups ?? []} tracked={tracked} onTrack={addTrack} onAd={addAd} />}
      {tab === "ad" && <AdKeywordsPanel storeId={storeId} groups={groups} onChanged={reload} onMsg={setMsg} />}
    </div>
  );
}

/* ---------- 추적 (지도·블로그 노출) ---------- */
function TrackPanel({ storeId, search, onChanged }: { storeId: string; search: SearchInfo; onChanged: () => void }) {
  const [edit, setEdit] = useState(search.keywords.length === 0);
  const [terms, setTerms] = useState(search.terms.join(", "));
  const [keywords, setKeywords] = useState(search.keywords.join(", "));
  const [busy, startBusy] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  function save(thenCheck: boolean) {
    setMsg(null);
    startBusy(async () => {
      const r = await saveSearchSettings(storeId, terms, keywords);
      if (!r.ok) return setMsg(r.error);
      if (thenCheck) {
        const c = await checkSearchNow(storeId);
        if (!c.ok) return setMsg(c.error);
      }
      setEdit(false);
      onChanged();
    });
  }
  function checkNow() {
    setMsg(null);
    startBusy(async () => {
      const c = await checkSearchNow(storeId);
      if (!c.ok) setMsg(c.error);
      else onChanged();
    });
  }
  const rankTxt = (r: number | null) => (r == null ? "밖" : `${r}위`);
  const delta = (cur: number | null, prev: number | null, lowerBetter: boolean) => {
    if (prev == null || cur == null) return null;
    if (cur === prev) return { t: "=", c: "text-muted" };
    const better = lowerBetter ? cur < prev : cur > prev;
    return { t: better ? "▲" : "▼", c: better ? "text-green-700" : "text-red-600" };
  };
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-bold">추적 키워드 (지도 상위5 · 블로그 상위30)</h2>
        <div className="flex gap-1.5">
          {search.keywords.length > 0 && !edit && (
            <button type="button" onClick={checkNow} disabled={busy} className="rounded-lg border border-border px-2 py-1 text-[11px] disabled:opacity-50">
              {busy ? "확인 중…" : "지금 확인"}
            </button>
          )}
          <button type="button" onClick={() => setEdit(!edit)} className="rounded-lg border border-border px-2 py-1 text-[11px]">
            {edit ? "닫기" : "설정"}
          </button>
        </div>
      </div>
      <p className="mb-2 text-[11px] text-muted">매일 새벽 자동 확인. 키워드는 연관 키워드·조합 검색 탭에서 &lsquo;+ 추적&rsquo;으로도 넣을 수 있어요.</p>
      {edit && (
        <div className="mb-3 flex flex-col gap-1.5 rounded-xl bg-background p-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted">매장 식별어 (쉼표로 구분 · 검색 결과에서 우리 가게/우리 글을 알아보는 말)</span>
            <input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="예: 제이드앤워터, 서울역점" className="rounded-lg border border-border bg-card px-2 py-1.5 text-foreground" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted">추적 키워드 (최대 10개 · 쉼표로 구분)</span>
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="예: 서울역 맛집, 서울역 브런치, 서울역 파스타" className="rounded-lg border border-border bg-card px-2 py-1.5 text-foreground" />
          </label>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => save(true)} disabled={busy} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-50">
              {busy ? "확인 중…" : "저장하고 지금 확인"}
            </button>
            <button type="button" onClick={() => save(false)} disabled={busy} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50">
              저장만
            </button>
          </div>
        </div>
      )}
      {msg && <p className="mb-2 text-xs text-red-600">{msg}</p>}
      {search.rows.length > 0 ? (
        <>
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-left text-[11px] text-muted">
                <th className="pb-1 font-medium">키워드</th>
                <th className="pb-1 text-right font-medium">월 검색</th>
                <th className="pb-1 text-right font-medium">지도 상위5</th>
                <th className="pb-1 text-right font-medium">블로그 우리 글</th>
              </tr>
            </thead>
            <tbody>
              {search.rows.map((r) => {
                const dm = delta(r.mapRank ?? 99, r.mapRankPrev ?? (r.mapRankPrev === null && r.blogHitsPrev != null ? 99 : null), true);
                const db = delta(r.blogHits, r.blogHitsPrev, false);
                return (
                  <tr key={r.keyword} className="border-t border-border">
                    <td className="py-1.5 font-semibold">{r.keyword}</td>
                    <td className="py-1.5 text-right text-muted">{fmt(r.volume)}</td>
                    <td className={`py-1.5 text-right ${r.mapRank == null ? "text-red-600" : "text-green-700"}`}>
                      {rankTxt(r.mapRank)}
                      {dm && <span className={`ml-1 text-[10px] ${dm.c}`}>{dm.t}</span>}
                    </td>
                    <td className={`py-1.5 text-right ${r.blogHits === 0 ? "text-red-600" : ""}`}>
                      {r.blogHits}개{db && <span className={`ml-1 text-[10px] ${db.c}`}>{db.t}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1.5 text-[10px] text-muted">
            {search.checkedAt ? `${new Date(search.checkedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 확인` : "아직 확인 전 — &lsquo;지금 확인&rsquo;을 눌러 주세요"} · 화살표는 일주일 전 대비. 검색 큰데 지도 &lsquo;밖&rsquo; = 플레이스 광고 유지 + 영수증 리뷰 늘리기. 블로그 0개 → 체험단 글 제목에 그 키워드 넣기.
          </p>
          <BlogPostsBox rows={search.rows} />
        </>
      ) : (
        <p className="text-xs text-muted">추적할 키워드를 넣어 주세요. 손님이 실제로 검색할 법한 말(동네+맛집, 동네+메뉴)이 좋아요.</p>
      )}
    </section>
  );
}

/* ---------- 블로그 상위30 중 우리 글 목록 ---------- */
function BlogPostsBox({ rows }: { rows: SearchInfo["rows"] }) {
  const withPosts = rows.filter((r) => r.blogPosts.length > 0);
  const total = withPosts.reduce((n, r) => n + r.blogPosts.length, 0);
  return (
    <div className="mt-3 rounded-xl bg-background p-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <h3 className="text-xs font-bold">블로그 우리 글 {total > 0 && <span className="ml-1 font-normal text-muted">{total}개</span>}</h3>
        <span className="text-[10px] text-muted">키워드별 상위30 안 순위 · 제목 누르면 글 열림</span>
      </div>
      {withPosts.length === 0 ? (
        <p className="text-[11px] text-muted">아직 상위30 안에 우리 글이 없어요. 체험단 글 제목에 추적 키워드를 그대로 넣어 주세요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {withPosts.map((r) => (
            <li key={r.keyword}>
              <p className="mb-0.5 text-[11px] font-semibold">
                {r.keyword} <span className="font-normal text-muted">{r.blogPosts.length}개</span>
              </p>
              <ul className="flex flex-col gap-0.5">
                {r.blogPosts.map((p) => (
                  <li key={`${r.keyword}-${p.rank}`} className="flex items-start gap-1.5 text-[11px]">
                    <span className="mt-0.5 shrink-0 rounded bg-green-50 px-1 font-bold tabular-nums text-green-700">{p.rank}위</span>
                    <div className="min-w-0 flex-1">
                      <a href={p.link} target="_blank" rel="noreferrer" className="block truncate underline-offset-2 hover:underline">
                        {p.title}
                      </a>
                      <p className="truncate text-[10px] text-muted">
                        {p.blogger}
                        {p.date && ` · ${p.date.slice(5).replace("-", "/")}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- 결과 한 줄 (연관·조합 공용) ---------- */
function KeywordRow({ kw, total, compIdx, registered, tracked, groups, adConnected, onTrack, onAd }: { kw: string; total: number | null; compIdx: string | null; registered: boolean; tracked: boolean; groups: AdKeywordGroup[]; adConnected: boolean; onTrack: (kw: string) => void; onAd: (kw: string, adgroupId: string, adgroupName: string) => void }) {
  const [pick, setPick] = useState(false);
  const onGroups = groups.filter((g) => g.on);
  return (
    <li className="rounded-md bg-card px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="font-semibold">{kw}</span>
          <span className="ml-1.5 text-[11px] text-muted">
            월 {fmt(total)}
            {compIdx && ` · 경쟁 ${compIdx}`}
          </span>
          {registered && <span className="ml-1.5 rounded bg-green-50 px-1 text-[9px] font-bold text-green-700">광고 등록됨</span>}
          {tracked && <span className="ml-1 rounded bg-blue-50 px-1 text-[9px] font-bold text-blue-700">추적 중</span>}
        </span>
        <span className="flex shrink-0 gap-1">
          {!tracked && (
            <button type="button" onClick={() => onTrack(kw)} className="rounded-md border border-brand px-2 py-0.5 text-[11px] font-semibold text-brand">
              + 추적
            </button>
          )}
          {adConnected && !registered && groups.length > 0 && (
            <button type="button" onClick={() => setPick(!pick)} className="rounded-md bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">
              + 광고
            </button>
          )}
        </span>
      </div>
      {pick && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          <span className="text-[10px] text-muted">어느 광고그룹에?</span>
          {(onGroups.length ? onGroups : groups).map((g) => (
            <button key={g.adgroupId} type="button" onClick={() => { setPick(false); onAd(kw, g.adgroupId, g.adgroupName); }} className="rounded-md border border-border px-2 py-0.5 text-[10px]">
              {g.adgroupName}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

/* ---------- 연관 키워드 ---------- */
function FindPanel({ storeId, adConnected, groups, registered, tracked, onTrack, onAd }: { storeId: string; adConnected: boolean; groups: AdKeywordGroup[]; registered: Set<string>; tracked: Set<string>; onTrack: (kw: string) => void; onAd: (kw: string, g: string, n: string) => void }) {
  const [hint, setHint] = useState("");
  const [ideas, setIdeas] = useState<KeywordIdea[] | null>(null);
  const [busy, startBusy] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  function find() {
    setErr(null);
    startBusy(async () => {
      const r = await findKeywords(storeId, hint);
      if (!r.ok) setErr(r.error);
      else setIdeas(r.ideas);
    });
  }
  if (!adConnected) return <p className="rounded-2xl border border-border bg-card p-4 text-xs text-muted">네이버 광고 계정이 연결된 매장만 키워드 도구를 쓸 수 있어요.</p>;
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-bold">연관 키워드 찾기</h2>
      <p className="mb-2 text-[11px] text-muted">동네나 메뉴를 넣으면 손님이 실제로 검색하는 말과 월 검색량(PC+모바일)이 나와요.</p>
      <div className="flex gap-1.5 text-xs">
        <input value={hint} onChange={(e) => setHint(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), find())} placeholder="예: 서울역 맛집" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-foreground" />
        <button type="button" onClick={find} disabled={busy || !hint.trim()} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-40">
          {busy ? "찾는 중…" : "찾기"}
        </button>
      </div>
      {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
      {ideas && (
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {ideas.map((i) => (
            <KeywordRow key={i.keyword} kw={i.keyword} total={i.total} compIdx={i.compIdx} registered={registered.has(norm(i.keyword))} tracked={tracked.has(norm(i.keyword))} groups={groups} adConnected={adConnected} onTrack={onTrack} onAd={onAd} />
          ))}
          {ideas.length === 0 && <li className="text-[11px] text-muted">결과가 없어요. 다른 말로 찾아 보세요.</li>}
        </ul>
      )}
    </section>
  );
}

/* ---------- 조합 검색 ---------- */
function ComboPanel({ storeId, adConnected, groups, tracked, onTrack, onAd }: { storeId: string; adConnected: boolean; groups: AdKeywordGroup[]; tracked: Set<string>; onTrack: (kw: string) => void; onAd: (kw: string, g: string, n: string) => void }) {
  const [regions, setRegions] = useState("");
  const [menus, setMenus] = useState("");
  const [mods, setMods] = useState("맛집");
  const [swap, setSwap] = useState(false);
  const [triple, setTriple] = useState(false);
  const [rows, setRows] = useState<ComboRow[] | null>(null);
  const [count, setCount] = useState(0);
  const [busy, startBusy] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const split = (t: string) => t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  const comboCount = (() => {
    const R = split(regions), M = split(menus), X = split(mods);
    if (!R.length || !M.length) return 0;
    let n = R.length * M.length * (swap ? 2 : 1);
    n += triple ? R.length * M.length * X.length : R.length * X.length;
    return n;
  })();
  function run() {
    setErr(null);
    startBusy(async () => {
      const r = await comboSearch(storeId, split(regions), split(menus), split(mods), { swap, triple });
      if (!r.ok) setErr(r.error);
      else {
        setRows(r.rows);
        setCount(r.combos);
      }
    });
  }
  if (!adConnected) return <p className="rounded-2xl border border-border bg-card p-4 text-xs text-muted">네이버 광고 계정이 연결된 매장만 쓸 수 있어요.</p>;
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-bold">조합 검색</h2>
      <p className="mb-2 text-[11px] text-muted">지역 × 메뉴 (× 수식어) 모든 조합의 월 검색량을 한 번에 봐요. 예: 지역 &lsquo;성수, 성수동&rsquo; × 메뉴 &lsquo;브런치, 파스타&rsquo; → 성수브런치, 성수동파스타…</p>
      <div className="flex flex-col gap-1.5 text-xs">
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted">지역·상권 (쉼표로 구분)</span>
          <input value={regions} onChange={(e) => setRegions(e.target.value)} placeholder="성수, 성수동, 뚝섬, 서울숲" className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted">메뉴·업종</span>
          <input value={menus} onChange={(e) => setMenus(e.target.value)} placeholder="브런치, 파스타, 와인바, 카페" className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted">수식어 (선택)</span>
          <input value={mods} onChange={(e) => setMods(e.target.value)} placeholder="맛집, 데이트, 단체, 모임" className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground" />
        </label>
        <div className="flex flex-wrap gap-3 text-[11px]">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} /> 순서 바꾼 조합도 (브런치성수)
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={triple} onChange={(e) => setTriple(e.target.checked)} /> 세 단어 조합도 (성수브런치맛집)
          </label>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted">조합 {comboCount}개{comboCount > 60 && " (60개까지만 조회)"}</span>
          <button type="button" onClick={run} disabled={busy || comboCount === 0} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-40">
            {busy ? "조회 중…" : "조합 조회"}
          </button>
        </div>
      </div>
      {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
      {rows && (
        <>
          <p className="mt-2 text-[11px] text-muted">{count}개 조합 · 검색량 큰 순. &lsquo;-&rsquo;는 네이버에 검색량 자료가 없는 말(거의 안 찾는 말).</p>
          <ul className="mt-1 flex flex-col gap-1 text-xs">
            {rows.map((r) => (
              <KeywordRow key={r.keyword} kw={r.keyword} total={r.total} compIdx={r.compIdx} registered={r.registered} tracked={tracked.has(norm(r.keyword))} groups={groups} adConnected={adConnected} onTrack={onTrack} onAd={onAd} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ---------- 광고 키워드 (등록된 입찰 키워드) ---------- */
function AdKeywordsPanel({ storeId, groups, onChanged, onMsg }: { storeId: string; groups: AdKeywordGroup[] | null; onChanged: () => void; onMsg: (m: string | null) => void }) {
  const [busy, startBusy] = useTransition();
  if (!groups) return <p className="rounded-2xl border border-border bg-card p-4 text-xs text-muted">네이버 광고 계정이 연결된 매장만 볼 수 있어요.</p>;
  if (!groups.length) return <p className="rounded-2xl border border-border bg-card p-4 text-xs text-muted">파워링크 캠페인이 없어요. (플레이스 광고는 키워드가 없고 업체 정보로 노출돼요)</p>;
  function toggle(g: AdKeywordGroup, k: AdKeywordGroup["keywords"][number]) {
    onMsg(null);
    startBusy(async () => {
      const r = await toggleAdKeyword(storeId, k.id, k.keyword, g.adgroupId, g.adgroupName, !k.on);
      if (!r.ok) onMsg(r.error);
      else onChanged();
    });
  }
  function remove(g: AdKeywordGroup, k: AdKeywordGroup["keywords"][number]) {
    if (!window.confirm(`'${k.keyword}'을(를) 광고에서 삭제할까요? 되돌리려면 다시 추가해야 해요.`)) return;
    onMsg(null);
    startBusy(async () => {
      const r = await removeAdKeyword(storeId, k.id, k.keyword, g.adgroupId, g.adgroupName);
      if (!r.ok) onMsg(r.error);
      else onChanged();
    });
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-muted">파워링크 광고그룹에 등록된 키워드. 끄면 그 키워드로는 광고가 안 나가요(언제든 다시 켜기). 삭제는 되돌릴 수 없어요.</p>
      {groups.map((g) => (
        <section key={g.adgroupId} className="rounded-2xl border border-border bg-card p-3">
          <p className="text-xs font-bold">
            {g.adgroupName} <span className="font-normal text-muted">· {g.campaignName}</span>
            {!g.on && <span className="ml-1 rounded bg-gray-100 px-1 text-[9px] text-gray-500">그룹 꺼짐</span>}
            <span className="ml-1 text-[11px] font-normal text-muted">{g.keywords.length}개</span>
          </p>
          {g.keywords.length === 0 ? (
            <p className="mt-1 text-[11px] text-muted">키워드 없음 — 연관 키워드·조합 검색에서 &lsquo;+ 광고&rsquo;로 넣어 주세요.</p>
          ) : (
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {g.keywords.map((k) => (
                <li key={k.id} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${k.on ? "border-border" : "border-dashed border-border text-muted"}`}>
                  <span className={k.on ? "" : "line-through"}>{k.keyword}</span>
                  <button type="button" onClick={() => toggle(g, k)} disabled={busy} className="text-brand">
                    {k.on ? "끄기" : "켜기"}
                  </button>
                  <button type="button" onClick={() => remove(g, k)} disabled={busy} className="text-red-600">
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
