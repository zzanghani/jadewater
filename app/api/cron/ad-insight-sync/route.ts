// 외부 API(토스·네이버·AI)를 여러 번 부르는 작업이라 기본 10초로는 모자란다. Hobby 플랜 최대 60초.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { addYmd, kstYmd } from "@/lib/adReport";
import { syncAdDaily, syncTossDaily } from "@/lib/adInsight";
import { syncWeather } from "@/lib/weather";

// Vercel Cron이 매일 23:50 KST(14:50 UTC)에 호출한다. 광고 계정이 연결된 매장마다
// 최근 7일 네이버 성과와 토스 매출을 쌓아 둔다 (화면은 이 테이블을 읽는다).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const service = createServiceClient();
  const today = kstYmd(0);
  const from = addYmd(today, -7);
  const [{ data: accounts }, { data: merchants }, { data: toss }] = await Promise.all([
    service.from("store_ad_accounts").select("*").eq("enabled", true),
    service.from("store_toss_merchants").select("store_id, merchant_id"),
    service.from("toss_settings").select("access_key, access_secret").eq("id", 1).maybeSingle(),
  ]);
  const merchantByStore = new Map((merchants ?? []).map((m) => [m.store_id, m.merchant_id]));
  const results: Record<string, string> = {};
  for (const a of accounts ?? []) {
    try {
      const n = await syncAdDaily(service, a.store_id, { customerId: a.naver_customer_id, apiKey: a.naver_api_key, secretKey: a.naver_secret_key }, from, today);
      let t = 0;
      const m = merchantByStore.get(a.store_id);
      if (m && toss) t = await syncTossDaily(service, a.store_id, { accessKey: toss.access_key, secretKey: toss.access_secret }, m, from, today);
      results[a.store_id] = `광고 ${n}일 · 토스 ${t}일`;
    } catch (e) {
      results[a.store_id] = `실패: ${(e as Error).message}`;
    }
  }
  // 토스만 연결된 매장도 매출은 쌓아 둔다
  for (const m of merchants ?? []) {
    if (results[m.store_id] || !toss) continue;
    try {
      const t = await syncTossDaily(service, m.store_id, { accessKey: toss.access_key, secretKey: toss.access_secret }, m.merchant_id, from, today);
      results[m.store_id] = `토스 ${t}일`;
    } catch (e) {
      results[m.store_id] = `실패: ${(e as Error).message}`;
    }
  }
  // 날씨(서울 공용) — 지난 1년치는 처음 한 번만 받고, 이후엔 최근 1주만 갱신된다.
  try {
    results.weather = `${await syncWeather(service, addYmd(today, -370), today)}일`;
  } catch (e) {
    results.weather = `실패: ${(e as Error).message}`;
  }
  console.log("[ad-insight-sync]", results);
  return NextResponse.json({ ok: true, results });
}
