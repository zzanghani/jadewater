"use server";

import { createClient } from "@/lib/supabase/server";
import { adReportAllowedFor } from "@/lib/adAccess";
import { createServiceClient } from "@/lib/supabase/service";
import { generateAdStrategy } from "@/lib/claude";
import { addYmd, kstYmd, type SalesMap } from "@/lib/adReport";
import { analyze, insightToPrompt, syncAdDaily, syncAdHourly, syncTossDaily, type AdInsight, type DailyRow } from "@/lib/adInsight";
import { fetchTossClosing } from "@/lib/tossClosing";
import { syncWeather } from "@/lib/weather";
import { syncSearchRanks } from "@/lib/searchRank";
import { keywordTool, type KeywordIdea } from "@/lib/naverAds";

export type SearchInfo = {
  terms: string[];
  keywords: string[];
  rows: { keyword: string; volume: number | null; mapRank: number | null; blogHits: number; mapRankPrev: number | null; blogHitsPrev: number | null }[];
  checkedAt: string | null;
  adConnected: boolean;
};
export type InsightResult =
  | { ok: true; insight: AdInsight; memo: string | null; memoAt: string | null; synced: { toss: number | null; ad: number | null; weather: number | null }; search: SearchInfo }
  | { ok: false; error: string };

type AuthResult =
  | { error: string; supabase?: undefined }
  | { error?: undefined; supabase: Awaited<ReturnType<typeof createClient>> };

async function authStore(storeId: string): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { data: p } = await supabase.from("profiles").select("role, store_id, department, status").eq("id", user.id).maybeSingle();
  if (!p || p.status !== "approved" || p.department || p.role !== "owner" || (p.store_id && p.store_id !== storeId)) {
    return { error: "이 매장의 광고 분석을 볼 권한이 없어요." };
  }
  if (!(await adReportAllowedFor(supabase, p))) return { error: "광고 효율 분석은 아직 시범 운영 중이라 이 계정에서는 볼 수 없어요." };
  return { supabase };
}

/**
 * 광고 효율 분석 — 필요하면 최근 28일을 동기화(sync=true)한 뒤 계산한다.
 * 오늘 매출은 토스에서 바로 읽는다(실시간).
 */
export async function loadAdInsight(storeId: string, opts: { sync?: boolean } = {}): Promise<InsightResult> {
  const auth = await authStore(storeId);
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  const { supabase } = auth;
  const service = createServiceClient();

  const [{ data: store }, { data: merchant }, { data: tossKeys }, { data: adAcct }] = await Promise.all([
    supabase.from("stores").select("name").eq("id", storeId).maybeSingle(),
    service.from("store_toss_merchants").select("merchant_id, is_test").eq("store_id", storeId).maybeSingle(),
    service.from("toss_settings").select("access_key, access_secret").eq("id", 1).maybeSingle(),
    service.from("store_ad_accounts").select("*").eq("store_id", storeId).eq("enabled", true).maybeSingle(),
  ]);
  if (!adAcct && !merchant) return { ok: false, error: "이 매장은 네이버 광고도 토스포스도 아직 연결되지 않았어요. 광고 리포트 → 매장 키 설정에서 등록해 주세요." };

  const today = kstYmd(0);
  const from = addYmd(today, -56);
  const keys = tossKeys ? { accessKey: tossKeys.access_key, secretKey: tossKeys.access_secret } : null;
  // 광고 계정이 없으면 매출만 보여준다 (광고비 0으로).
  const acct = adAcct ? { customerId: adAcct.naver_customer_id, apiKey: adAcct.naver_api_key, secretKey: adAcct.naver_secret_key } : null;

  const synced = { toss: null as number | null, ad: null as number | null, weather: null as number | null };
  if (opts.sync) {
    if (acct) {
      try {
        // 네이버는 31일 단위로 두 번
        const mid = addYmd(today, -28);
        const a1 = await syncAdDaily(service, storeId, acct, from, addYmd(mid, -1));
        const a2 = await syncAdDaily(service, storeId, acct, mid, today);
        synced.ad = a1 + a2;
        // 시간대별은 최근 28일만 (호출 수 절약)
        await syncAdHourly(service, storeId, acct, mid, today).catch(() => 0);
      } catch (e) {
        return { ok: false, error: `네이버 광고 성과를 못 읽었어요: ${(e as Error).message}` };
      }
    }
    if (keys && merchant) {
      try {
        synced.toss = await syncTossDaily(service, storeId, keys, merchant.merchant_id, from, addYmd(today, -1));
      } catch (e) {
        return { ok: false, error: `토스 매출을 못 읽었어요: ${(e as Error).message}` };
      }
    }
    // 날씨는 실패해도 분석은 계속한다 (보정만 빠짐). 크론이 매일 밤 다시 채운다.
    synced.weather = await syncWeather(service, addYmd(today, -370), today).catch(() => null);
  }

  const [{ data: tossRows }, { data: adRows }, { data: closings }, { data: memoRow }, { data: weatherRows }, { data: specialRows }, { data: setting }, { data: searchSetting }, { data: rankRows }] = await Promise.all([
    service.from("toss_daily_sales").select("date, sales, orders").eq("store_id", storeId).gte("date", addYmd(today, -370)).lte("date", today),
    service.from("ad_daily_stats").select("date, imp, clk, cost, conv").eq("store_id", storeId).gte("date", from).lte("date", today),
    service.from("daily_closings").select("date, grand_total").eq("store_id", storeId).gte("date", addYmd(today, -370)).lte("date", today),
    service.from("ad_insight_memos").select("memo, generated_at").eq("store_id", storeId).eq("date", today).maybeSingle(),
    service.from("weather_daily").select("date, precip_mm").gte("date", addYmd(today, -370)).lte("date", today),
    service.from("ad_special_days").select("date, note").eq("store_id", storeId).gte("date", addYmd(today, -370)),
    service.from("ad_store_settings").select("cost_rate").eq("store_id", storeId).maybeSingle(),
    service.from("store_search_settings").select("terms, keywords, volumes").eq("store_id", storeId).maybeSingle(),
    service.from("search_rank_daily").select("date, keyword, map_rank, blog_hits, checked_at").eq("store_id", storeId).gte("date", addYmd(today, -8)).order("date", { ascending: false }),
  ]);
  // 검색 노출: 가장 최근 확인값과 7일 전쯤 값
  const latestDate = rankRows?.[0]?.date ?? null;
  const latest = (rankRows ?? []).filter((r) => r.date === latestDate);
  const prevDate = (rankRows ?? []).map((r) => r.date).find((d) => d <= addYmd(latestDate ?? today, -6)) ?? null;
  const prev = (rankRows ?? []).filter((r) => r.date === prevDate);
  const search: SearchInfo = {
    terms: searchSetting?.terms ?? [],
    keywords: searchSetting?.keywords ?? [],
    rows: (searchSetting?.keywords ?? []).map((kw) => {
      const a = latest.find((r) => r.keyword === kw);
      const b = prev.find((r) => r.keyword === kw);
      return { keyword: kw, volume: (searchSetting?.volumes as Record<string, number> | null)?.[kw] ?? null, mapRank: a?.map_rank ?? null, blogHits: a?.blog_hits ?? 0, mapRankPrev: b ? b.map_rank : null, blogHitsPrev: b ? b.blog_hits : null };
    }),
    checkedAt: latest[0]?.checked_at ?? null,
    adConnected: !!adAcct,
  };
  const weather: Record<string, number> = {};
  for (const w of weatherRows ?? []) weather[w.date] = Number(w.precip_mm);
  const specials: Record<string, string> = {};
  for (const sp of specialRows ?? []) specials[sp.date] = sp.note || "특이일";
  const tossByDate = new Map((tossRows ?? []).map((r) => [r.date, r]));
  const adByDate = new Map((adRows ?? []).map((r) => [r.date, r]));
  // 평소 대비용 1년 매출: 토스가 있으면 토스, 없으면 마감입력
  const yearSales: SalesMap = {};
  for (const c of closings ?? []) if (c.grand_total) yearSales[c.date] = c.grand_total;
  for (const t of tossRows ?? []) if (t.sales) yearSales[t.date] = t.sales;

  const rows: DailyRow[] = [];
  for (let d = from; d <= today; d = addYmd(d, 1)) {
    const t = tossByDate.get(d);
    const a = adByDate.get(d);
    // 토스가 없는 매장은 마감입력 매출로 대신한다
    const fallback = !merchant ? (closings ?? []).find((c) => c.date === d)?.grand_total ?? null : null;
    rows.push({ date: d, sales: t ? t.sales : fallback, orders: t ? t.orders : null, imp: a?.imp ?? 0, clk: a?.clk ?? 0, cost: a?.cost ?? 0, conv: a?.conv ?? 0 });
  }

  // 오늘 실시간
  let todayLive = { sales: null as number | null, orders: null as number | null, lastPayAt: null as string | null };
  if (keys && merchant) {
    try {
      const c = await fetchTossClosing(keys, merchant.merchant_id, today);
      todayLive = { sales: c.paid, orders: c.orders, lastPayAt: c.lastPayAt };
    } catch {
      // 오늘 값만 비워 두고 나머지는 보여준다
    }
  }

  const insight = analyze({ storeId, storeName: store?.name ?? "매장", today, rows, yearSales, todayLive, adConnected: !!adAcct, weather, specials, costRate: setting ? Number(setting.cost_rate) : undefined });
  if (!adAcct) insight.findings.unshift({ sev: "info", text: "네이버 광고 계정이 아직 연결되지 않아 매출만 보여요. 키를 등록하면 광고비·ROAS가 채워져요." });
  return { ok: true, insight, memo: memoRow?.memo ?? null, memoAt: memoRow?.generated_at ?? null, synced, search };
}

export async function generateStrategyMemo(storeId: string): Promise<{ ok: true; memo: string } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "AI 키가 설정되지 않았어요." };
  const r = await loadAdInsight(storeId);
  if (!r.ok) return r;
  const searchText = r.search.rows.length
    ? `\n검색 노출(네이버): ${r.search.rows.map((x) => `${x.keyword}(월 검색 ${x.volume == null ? "?" : x.volume.toLocaleString("ko-KR")}) 지도 ${x.mapRank == null ? "상위5 밖" : x.mapRank + "위"}·블로그 상위30 중 우리 글 ${x.blogHits}개`).join(", ")}`
    : "";
  const memo = await generateAdStrategy(insightToPrompt(r.insight) + searchText, apiKey);
  if (!memo) return { ok: false, error: "AI 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요." };
  const service = createServiceClient();
  await service.from("ad_insight_memos").upsert({ store_id: storeId, date: kstYmd(0), memo, generated_at: new Date().toISOString() }, { onConflict: "store_id,date" });
  return { ok: true, memo };
}

/* ---------- 손익분기·특이일 설정 ---------- */
export async function saveCostRate(storeId: string, ratePct: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  const rate = Number(ratePct) / 100;
  if (!isFinite(rate) || rate < 0 || rate >= 0.95) return { ok: false, error: "원가율은 0~94% 사이로 넣어 주세요." };
  const {
    data: { user },
  } = await auth.supabase.auth.getUser();
  const { error } = await createServiceClient()
    .from("ad_store_settings")
    .upsert({ store_id: storeId, cost_rate: rate, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: "store_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addSpecialDay(storeId: string, date: string, note: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "날짜를 골라 주세요." };
  const {
    data: { user },
  } = await auth.supabase.auth.getUser();
  const { error } = await createServiceClient()
    .from("ad_special_days")
    .upsert({ store_id: storeId, date, note: note.trim().slice(0, 40), created_by: user?.id ?? null }, { onConflict: "store_id,date" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeSpecialDay(storeId: string, date: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  const { error } = await createServiceClient().from("ad_special_days").delete().eq("store_id", storeId).eq("date", date);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ---------- 검색 노출 추적 설정 ---------- */
export async function saveSearchSettings(storeId: string, termsText: string, keywordsText: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  const split = (t: string) => Array.from(new Set(t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)));
  const terms = split(termsText).slice(0, 10);
  const keywords = split(keywordsText).slice(0, 10);
  if (!terms.length) return { ok: false, error: "매장 식별어를 하나 이상 넣어 주세요 (예: 제이드앤워터, 서울역점)." };
  const {
    data: { user },
  } = await auth.supabase.auth.getUser();
  const service = createServiceClient();
  const { error } = await service.from("store_search_settings").upsert({ store_id: storeId, terms, keywords, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: "store_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function checkSearchNow(storeId: string): Promise<{ ok: true; n: number } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  try {
    const n = await syncSearchRanks(createServiceClient(), kstYmd(0), storeId);
    if (n === 0) return { ok: false, error: "확인할 키워드가 없거나 네이버 검색 키가 설정되지 않았어요." };
    return { ok: true, n };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 연관 키워드 + 월 검색량 (네이버 키워드 도구). 광고 계정이 연결된 매장만. */
export async function findKeywords(storeId: string, hint: string): Promise<{ ok: true; ideas: KeywordIdea[] } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  const h = hint.trim();
  if (!h) return { ok: false, error: "찾을 말을 넣어 주세요 (예: 서울역 맛집)." };
  const { data: a } = await createServiceClient().from("store_ad_accounts").select("naver_customer_id, naver_api_key, naver_secret_key").eq("store_id", storeId).eq("enabled", true).maybeSingle();
  if (!a) return { ok: false, error: "네이버 광고 계정이 연결된 매장만 키워드 도구를 쓸 수 있어요." };
  try {
    const ideas = await keywordTool({ customerId: a.naver_customer_id, apiKey: a.naver_api_key, secretKey: a.naver_secret_key }, h.split(/[,\s]+/).filter(Boolean).slice(0, 5));
    return { ok: true, ideas: ideas.slice(0, 40) };
  } catch (e) {
    return { ok: false, error: `네이버 키워드 도구 오류: ${(e as Error).message}` };
  }
}
