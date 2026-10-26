// 외부 API(토스·네이버·AI)를 여러 번 부르는 작업이라 기본 10초로는 모자란다. Hobby 플랜 최대 60초.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPush } from "@/lib/webpush";
import { addYmd, buildStoreReport, weekWindows, type AdStoreReport, type SalesMap } from "@/lib/adReport";

// Vercel Cron이 매주 월요일 08:47(KST)에 호출한다 (vercel.json: 47 23 * * 0 UTC).
// 연결된 매장마다 지난주 리포트를 만들어 저장하고, 그 매장 지점장과 본사 마스터에게
// '이번 주 가장 먼저 할 일' 한 줄을 푸시로 보낸다.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const W = weekWindows();
  const { data: accounts } = await supabase.from("store_ad_accounts").select("*").eq("enabled", true);
  if (!accounts?.length) return NextResponse.json({ ok: true, stores: 0 });

  const { data: storeRows } = await supabase.from("stores").select("id, name, short_label").in("id", accounts.map((a) => a.store_id));
  const storeById = new Map((storeRows ?? []).map((s) => [s.id, s]));
  const { data: masters } = await supabase.from("profiles").select("id").eq("role", "owner").is("store_id", null).is("department", null).eq("status", "approved");
  const masterIds = (masters ?? []).map((m) => m.id);

  const results: Record<string, string> = {};
  for (const a of accounts) {
    const store = storeById.get(a.store_id);
    const name = store?.name ?? "매장";
    let r: AdStoreReport;
    try {
      const { data: rows } = await supabase.from("daily_closings").select("date, grand_total").eq("store_id", a.store_id).gte("date", addYmd(W.yesterday, -370)).lte("date", W.yesterday);
      const sales: SalesMap = {};
      for (const row of rows ?? []) sales[row.date] = row.grand_total ?? 0;
      r = await buildStoreReport({
        storeId: a.store_id,
        name,
        acct: { customerId: a.naver_customer_id, apiKey: a.naver_api_key, secretKey: a.naver_secret_key },
        budget: a.monthly_budget,
        targetCpa: a.target_cpa,
        sales: Object.keys(sales).length ? sales : null,
        W,
      });
    } catch (e) {
      results[name] = `실패: ${(e as Error).message}`;
      console.error("[ad-weekly-report]", name, e);
      continue;
    }
    await supabase.from("ad_weekly_reports").upsert(
      { store_id: a.store_id, week_start: W.week[0], report: r as unknown as Record<string, unknown>, generated_at: new Date().toISOString() },
      { onConflict: "store_id,week_start" }
    );

    // 받는 사람: 그 매장 지점장 + 본사 마스터
    const { data: owners } = await supabase.from("profiles").select("id").eq("store_id", a.store_id).eq("role", "owner").is("department", null).eq("status", "approved");
    const targets = Array.from(new Set([...(owners ?? []).map((o) => o.id), ...masterIds]));
    const first = r.actions[0];
    const payload = {
      title: `${store?.short_label ?? name} 광고 주간 리포트`,
      body: first
        ? `${first.sev === "bad" ? "조치 필요" : first.sev === "warn" ? "점검" : "기회"} · ${first.text}`
        : `지난주 광고비 ${Math.round(r.week.cost).toLocaleString()}원 · 급한 조치 없음`,
      url: "/ad-report",
    };
    let sent = 0;
    for (const userId of targets) {
      const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
      if (!subs?.length) continue;
      const expired: string[] = [];
      await Promise.all(
        subs.map(async (s) => {
          const { expired: ex } = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
          if (ex) expired.push(s.id);
          else sent++;
        })
      );
      if (expired.length) await supabase.from("push_subscriptions").delete().in("id", expired);
    }
    results[name] = `${sent}건 발송`;
  }
  console.log("[ad-weekly-report]", results);
  return NextResponse.json({ ok: true, week: W.week, results });
}
