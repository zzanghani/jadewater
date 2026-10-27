"use client";

import { useEffect, useState, useTransition } from "react";
import { checkSearchNow, findKeywords, loadSearchInfo, saveSearchSettings, type SearchInfo } from "@/app/(app)/ad-report/insight/actions";
import type { KeywordIdea } from "@/lib/naverAds";

export default function AdSearchClient({ storeId }: { storeId: string }) {
  const [info, setInfo] = useState<SearchInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, start] = useTransition();
  const reload = () =>
    start(async () => {
      const r = await loadSearchInfo(storeId);
      if (r.ok) setInfo(r.search);
      else setErr(r.error);
    });
  useEffect(() => {
    start(async () => {
      const r = await loadSearchInfo(storeId);
      if (r.ok) setInfo(r.search);
      else setErr(r.error);
    });
  }, [storeId]);
  if (err) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>;
  if (!info) return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">{loading ? "불러오는 중..." : ""}</p>;
  return <SearchRank storeId={storeId} search={info} onChanged={reload} />;
}

// 검색 노출: 키워드마다 네이버 지도 상위5 순위와 블로그 상위30 중 우리 글 수. 매일 새벽 자동 확인.
function SearchRank({ storeId, search, onChanged }: { storeId: string; search: SearchInfo; onChanged: () => void }) {
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
        <h2 className="text-sm font-bold">검색 노출 (네이버)</h2>
        <div className="flex gap-1.5">
          {search.keywords.length > 0 && !edit && (
            <button type="button" onClick={checkNow} disabled={busy} className="rounded-lg border border-border px-2 py-1 text-[11px] disabled:opacity-50">
              {busy ? "확인 중…" : "지금 확인"}
            </button>
          )}
          <button type="button" onClick={() => setEdit(!edit)} className="rounded-lg border border-border px-2 py-1 text-[11px]">
            {edit ? "닫기" : "키워드 설정"}
          </button>
        </div>
      </div>
      <p className="mb-2 text-[11px] text-muted">손님이 검색하는 말로 네이버 지도 상위 5에 우리 가게가 있는지, 블로그 상위 30에 우리 글이 몇 개인지 매일 새벽에 확인해요.</p>
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
          {search.adConnected && <KeywordFinder storeId={storeId} onPick={(kw) => setKeywords((k) => (k.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).includes(kw) ? k : k.trim() ? `${k.trim()}, ${kw}` : kw))} />}
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
                    <td className="py-1.5 text-right text-muted">{r.volume == null ? "-" : r.volume.toLocaleString("ko-KR")}</td>
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
            {search.checkedAt ? `${new Date(search.checkedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 확인` : "아직 확인 전 — &lsquo;지금 확인&rsquo;을 눌러 주세요"} · 화살표는 일주일 전 대비. 월 검색은 PC+모바일(네이버 키워드 도구). 검색 큰데 지도 &lsquo;밖&rsquo; = 플레이스 광고 유지 + 영수증 리뷰 늘리기. 블로그 0개 → 체험단 글 제목에 그 키워드 넣기.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted">추적할 키워드를 넣어 주세요. 손님이 실제로 검색할 법한 말(동네+맛집, 동네+메뉴)이 좋아요.</p>
      )}
    </section>
  );
}

// 연관 키워드 찾기: 동네·메뉴 같은 말을 넣으면 네이버 키워드 도구에서 후보와 월 검색량을 받아 추적 목록에 바로 넣는다.
function KeywordFinder({ storeId, onPick }: { storeId: string; onPick: (kw: string) => void }) {
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
  return (
    <div className="rounded-lg border border-dashed border-border p-2">
      <p className="mb-1 text-[11px] text-muted">연관 키워드 찾기 — 동네나 메뉴를 넣으면 손님이 실제로 검색하는 말과 월 검색량이 나와요</p>
      <div className="flex gap-1.5">
        <input value={hint} onChange={(e) => setHint(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), find())} placeholder="예: 서울역 맛집" className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-foreground" />
        <button type="button" onClick={find} disabled={busy || !hint.trim()} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-40">
          {busy ? "찾는 중…" : "찾기"}
        </button>
      </div>
      {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
      {ideas && (
        <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
          {ideas.map((i) => (
            <li key={i.keyword} className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1">
              <span>
                <span className="font-semibold">{i.keyword}</span>
                <span className="ml-1.5 text-[11px] text-muted">월 {i.total.toLocaleString("ko-KR")}{i.compIdx && ` · 경쟁 ${i.compIdx === "높음" ? "높음" : i.compIdx === "중간" ? "중간" : i.compIdx === "낮음" ? "낮음" : i.compIdx}`}</span>
              </span>
              <button type="button" onClick={() => onPick(i.keyword)} className="shrink-0 rounded-md border border-brand px-2 py-0.5 text-[11px] font-semibold text-brand">
                + 추적
              </button>
            </li>
          ))}
          {ideas.length === 0 && <li className="text-[11px] text-muted">결과가 없어요. 다른 말로 찾아 보세요.</li>}
        </ul>
      )}
    </div>
  );
}
