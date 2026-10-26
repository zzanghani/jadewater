"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateAdStrategy } from "@/lib/claude";
import { addYmd, kstYmd, type SalesMap } from "@/lib/adReport";
import { analyze, insightToPrompt, syncAdDaily, syncTossDaily, type AdInsight, type DailyRow } from "@/lib/adInsight";
import { fetchTossClosing } from "@/lib/tossClosing";
import { syncWeather } from "@/lib/weather";

export type InsightResult =
  | { ok: true; insight: AdInsight; memo: string | null; memoAt: string | null; synced: { toss: number | null; ad: number | null; weather: number | null } }
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

  const [{ data: tossRows }, { data: adRows }, { data: closings }, { data: memoRow }, { data: weatherRows }, { data: specialRows }, { data: setting }] = await Promise.all([
    service.from("toss_daily_sales").select("date, sales, orders").eq("store_id", storeId).gte("date", addYmd(today, -370)).lte("date", today),
    service.from("ad_daily_stats").select("date, imp, clk, cost, conv").eq("store_id", storeId).gte("date", from).lte("date", today),
    service.from("daily_closings").select("date, grand_total").eq("store_id", storeId).gte("date", addYmd(today, -370)).lte("date", today),
    service.from("ad_insight_memos").select("memo, generated_at").eq("store_id", storeId).eq("date", today).maybeSingle(),
    service.from("weather_daily").select("date, precip_mm").gte("date", addYmd(today, -370)).lte("date", today),
    service.from("ad_special_days").select("date, note").eq("store_id", storeId).gte("date", addYmd(today, -370)),
    service.from("ad_store_settings").select("cost_rate").eq("store_id", storeId).maybeSingle(),
  ]);
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
  return { ok: true, insight, memo: memoRow?.memo ?? null, memoAt: memoRow?.generated_at ?? null, synced };
}

export async function generateStrategyMemo(storeId: string): Promise<{ ok: true; memo: string } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "AI 키가 설정되지 않았어요." };
  const r = await loadAdInsight(storeId);
  if (!r.ok) return r;
  const memo = await generateAdStrategy(insightToPrompt(r.insight), apiKey);
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
