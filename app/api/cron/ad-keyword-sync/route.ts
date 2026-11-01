// 네이버 호출이 매장당 수십 회라(캠페인·광고그룹·키워드 목록 + 통계) 23:50 동기화와 따로 돈다. 최대 60초.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { addYmd, kstYmd } from "@/lib/adReport";
import { syncAdKeywordDaily } from "@/lib/adInsight";

// Vercel Cron이 매일 23:55 KST(14:55 UTC)에 호출한다. 광고 계정이 연결된 매장마다
// 최근 7일 키워드별 성과(노출·클릭·광고비·전환·평균순위)와 오늘의 입찰가·품질지수를 ad_keyword_daily_stats에 쌓는다.
// 매일 07시 광고 점검(마케터)은 이 테이블만 읽는다.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const service = createServiceClient();
  const today = kstYmd(0);
  const from = addYmd(today, -7);
  const { data: accounts } = await service.from("store_ad_accounts").select("*").eq("enabled", true);
  const results: Record<string, string> = {};
  for (const a of accounts ?? []) {
    try {
      const acct = { customerId: a.naver_customer_id, apiKey: a.naver_api_key, secretKey: a.naver_secret_key };
      const r = await syncAdKeywordDaily(service, a.store_id, acct, from, today);
      results[a.store_id] = `키워드 ${r.keywords}개 × ${r.days}일`;
    } catch (e) {
      results[a.store_id] = `실패: ${(e as Error).message}`;
    }
  }
  console.log("[ad-keyword-sync]", results);
  return NextResponse.json({ ok: true, results });
}
