// 검색 노출 추적 (운영관리 앱 "검색 노출" 탭): 네이버 검색 API로 키워드마다
// 지도(지역검색) 상위 5에 우리 가게가 몇 위인지, 블로그 상위 30에 우리 글이 몇 개인지 본다.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { keywordTool } from "@/lib/naverAds";

const strip = (t: string) => t.replace(/<[^>]+>/g, "").replace(/&quot;|&amp;|&lt;|&gt;|&#39;/g, " ").replace(/\s+/g, "").toLowerCase();
const norm = (t: string) => t.replace(/\s+/g, "").toLowerCase();

async function naverGet<T>(path: string, clientId: string, clientSecret: string): Promise<T | null> {
  const res = await fetch(`https://openapi.naver.com${path}`, { headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret }, signal: AbortSignal.timeout(8000), cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json()) as T;
}

export type RankCheck = { keyword: string; mapRank: number | null; blogHits: number };

/** 한 키워드 확인: 지도 상위5 순위 + 블로그 상위30 중 우리 글 수. terms = 매장 식별어(예: 제이드앤워터, 서울역점). */
export async function checkKeyword(keyword: string, terms: string[], clientId: string, clientSecret: string): Promise<RankCheck> {
  const ts = terms.map(norm).filter(Boolean);
  const hit = (text: string) => ts.some((t) => text.includes(t));
  const q = encodeURIComponent(keyword);
  const [local, blog] = await Promise.all([
    naverGet<{ items?: { title: string; address?: string; roadAddress?: string }[] }>(`/v1/search/local.json?query=${q}&display=5&sort=comment`, clientId, clientSecret),
    naverGet<{ items?: { title: string; description: string }[] }>(`/v1/search/blog.json?query=${q}&display=30&sort=sim`, clientId, clientSecret),
  ]);
  let mapRank: number | null = null;
  (local?.items ?? []).forEach((it, i) => {
    if (mapRank == null && hit(strip(it.title))) mapRank = i + 1;
  });
  const blogHits = (blog?.items ?? []).filter((it) => hit(strip(it.title) + strip(it.description))).length;
  return { keyword, mapRank, blogHits };
}

/** 설정이 있는 매장(또는 한 매장)의 키워드를 모두 확인해 오늘 날짜로 저장한다. */
export async function syncSearchRanks(service: SupabaseClient<Database>, today: string, onlyStoreId?: string): Promise<number> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return 0;
  let q = service.from("store_search_settings").select("store_id, terms, keywords");
  if (onlyStoreId) q = q.eq("store_id", onlyStoreId);
  const { data: settings } = await q;
  let n = 0;
  for (const s of settings ?? []) {
    const kws = (s.keywords ?? []).filter(Boolean).slice(0, 10);
    if (!kws.length || !(s.terms ?? []).length) continue;
    const rows = [];
    for (const kw of kws) {
      const r = await checkKeyword(kw, s.terms, clientId, clientSecret);
      rows.push({ store_id: s.store_id, date: today, keyword: kw, map_rank: r.mapRank, blog_hits: r.blogHits, checked_at: new Date().toISOString() });
    }
    if (rows.length) await service.from("search_rank_daily").upsert(rows, { onConflict: "store_id,date,keyword" });
    n += rows.length;
    // 월 검색량(네이버 키워드 도구) — 광고 계정이 있을 때만
    try {
      const { data: a } = await service.from("store_ad_accounts").select("naver_customer_id, naver_api_key, naver_secret_key").eq("store_id", s.store_id).eq("enabled", true).maybeSingle();
      if (a) {
        const ideas = await keywordTool({ customerId: a.naver_customer_id, apiKey: a.naver_api_key, secretKey: a.naver_secret_key }, kws);
        const volumes: Record<string, number> = {};
        for (const kw of kws) {
          const hit = ideas.find((i) => norm(i.keyword) === norm(kw));
          if (hit) volumes[kw] = hit.total;
        }
        await service.from("store_search_settings").update({ volumes }).eq("store_id", s.store_id);
      }
    } catch {
      // 검색량은 없어도 순위는 저장됨
    }
  }
  return n;
}
