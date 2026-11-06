// 외부 API(토스·네이버·AI)를 여러 번 부르는 작업이라 기본 10초로는 모자란다. Hobby 플랜 최대 60초.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPush } from "@/lib/webpush";
import { addYmd, kstYmd } from "@/lib/adReport";
import { syncAdDaily, syncTossDaily } from "@/lib/adInsight";
import { adDailyAllPushBody, adDailyPostPushBody, adDailyPostToText, buildAdDailyPost, combineAdDailyPosts, type AdDailyPost } from "@/lib/adDailyPost";
import { generateAdDailyComment } from "@/lib/claude";

// Vercel Cron이 매일 아침 08:00 KST(23:00 UTC)에 호출한다.
// 광고·토스가 연결된 매장마다 어제 성과를 다시 받아 "성과 확인 게시판" 글을 올리고,
// 그 매장 지점장과 본사 마스터에게 푸시를 보낸다.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const service = createServiceClient();
  // 호출 토큰: Vercel CRON_SECRET 또는 Supabase Vault의 cron_secret (출퇴근 알림 크론과 같은 방식 — 수동으로 다시 돌릴 때 DB에서 부른다).
  const { data: dbToken } = await service.rpc("attendance_cron_token");
  const accepted = [process.env.CRON_SECRET, dbToken].filter((t): t is string => typeof t === "string" && t.length > 0);
  if (accepted.length === 0 || !accepted.some((t) => authHeader === `Bearer ${t}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const today = kstYmd(0);
  const y = addYmd(today, -1);
  const [{ data: accounts }, { data: merchants }, { data: toss }, { data: storeRows }, { data: masters }] = await Promise.all([
    service.from("store_ad_accounts").select("*").eq("enabled", true),
    service.from("store_toss_merchants").select("store_id, merchant_id"),
    service.from("toss_settings").select("access_key, access_secret").eq("id", 1).maybeSingle(),
    service.from("stores").select("id, name, short_label"),
    service.from("profiles").select("id, role, department").is("store_id", null).eq("status", "approved"),
  ]);
  const acctByStore = new Map((accounts ?? []).map((a) => [a.store_id, a]));
  const merchantByStore = new Map((merchants ?? []).map((m) => [m.store_id, m.merchant_id]));
  const storeIds = Array.from(new Set([...acctByStore.keys(), ...merchantByStore.keys()]));
  // 본사 급: 대표님(owner, 부서 없음) + 마케팅팀
  const masterIds = (masters ?? []).filter((m) => (m.role === "owner" && !m.department) || m.department === "marketing").map((m) => m.id);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const results: Record<string, string> = {};
  const built: { storeId: string; name: string; post: AdDailyPost }[] = [];

  async function pushTo(userIds: string[], payload: { title: string; body: string; url: string }): Promise<number> {
    let sent = 0;
    for (const userId of Array.from(new Set(userIds))) {
      const { data: subs } = await service.from("push_subscriptions").select("*").eq("user_id", userId);
      if (!subs?.length) continue;
      const expired: string[] = [];
      await Promise.all(
        subs.map(async (s) => {
          const { expired: ex } = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
          if (ex) expired.push(s.id);
          else sent++;
        })
      );
      if (expired.length) await service.from("push_subscriptions").delete().in("id", expired);
    }
    return sent;
  }

  await Promise.all(
    storeIds.map(async (storeId) => {
      const store = (storeRows ?? []).find((s) => s.id === storeId);
      const name = store?.name ?? "매장";
      try {
        const a = acctByStore.get(storeId);
        const merchantId = merchantByStore.get(storeId);
        const notes: string[] = [];
        // 어제 성과를 다시 받는다 (밤 11:50 동기화는 그날 마지막 10분이 빠져 있다).
        if (a) {
          await syncAdDaily(service, storeId, { customerId: a.naver_customer_id, apiKey: a.naver_api_key, secretKey: a.naver_secret_key }, addYmd(y, -7), y).catch((e: Error) => notes.push(`네이버 ${e.message}`));
        }
        if (merchantId && toss) {
          await syncTossDaily(service, storeId, { accessKey: toss.access_key, secretKey: toss.access_secret }, merchantId, addYmd(y, -1), y).catch((e: Error) => notes.push(`토스 ${e.message}`));
        }
        const from = addYmd(y, -14) < y.slice(0, 7) + "-01" ? addYmd(y, -14) : y.slice(0, 7) + "-01";
        const [{ data: adRows }, { data: tossRows }, { data: closings }] = await Promise.all([
          service.from("ad_daily_stats").select("date, imp, clk, cost, conv").eq("store_id", storeId).gte("date", from).lte("date", y),
          service.from("toss_daily_sales").select("date, sales, orders").eq("store_id", storeId).gte("date", from).lte("date", y),
          service.from("daily_closings").select("date, grand_total").eq("store_id", storeId).gte("date", from).lte("date", y),
        ]);
        const ad: Record<string, { imp: number; clk: number; cost: number; conv: number }> = {};
        for (const r of adRows ?? []) ad[r.date] = { imp: r.imp, clk: r.clk, cost: r.cost, conv: r.conv };
        const sales: Record<string, { sales: number; orders: number | null }> = {};
        const salesSource: "toss" | "closing" | null = merchantId ? "toss" : (closings ?? []).length ? "closing" : null;
        if (merchantId) for (const r of tossRows ?? []) sales[r.date] = { sales: r.sales, orders: r.orders };
        else for (const r of closings ?? []) if (r.grand_total > 0) sales[r.date] = { sales: r.grand_total, orders: null };

        const post = buildAdDailyPost({ date: y, storeName: name, adConnected: !!a, salesSource, ad, sales, budget: a?.monthly_budget ?? null });
        // AI 한마디는 시간이 남을 때만 (전체 60초 제한).
        if (apiKey && Date.now() - started < 35_000) {
          post.comment = await generateAdDailyComment(adDailyPostToText(post), apiKey).catch(() => null);
        }
        await service.from("ad_daily_posts").upsert({ store_id: storeId, date: y, post: post as unknown as Record<string, unknown>, generated_at: new Date().toISOString() }, { onConflict: "store_id,date" });

        built.push({ storeId, name, post });
        // 푸시: 그 매장 지점장에게 매장 글 (본사에는 아래에서 전체 합계 한 통)
        const { data: owners } = await service.from("profiles").select("id").eq("store_id", storeId).eq("role", "owner").is("department", null).eq("status", "approved");
        const sent = await pushTo(
          (owners ?? []).map((o) => o.id),
          { title: `${store?.short_label ?? name} 어제 광고 성과`, body: adDailyPostPushBody(post), url: "/ad-report/board" }
        );
        results[name] = `게시 완료 · 푸시 ${sent}건${post.comment ? " · AI 한마디" : ""}${notes.length ? ` · ${notes.join(", ")}` : ""}`;
      } catch (e) {
        results[name] = `실패: ${(e as Error).message}`;
        console.error("[ad-daily-post]", name, e);
      }
    })
  );
  // 본사(대표님·마케팅팀): 전체 매장 합계 한 통
  if (built.length) {
    const all = combineAdDailyPosts(y, built);
    const sent = await pushTo(masterIds, { title: "어제 광고 성과 (전체 매장)", body: adDailyAllPushBody(all), url: "/ad-report/board?view=all" });
    results["전체"] = `본사 푸시 ${sent}건`;
  }
  console.log("[ad-daily-post]", y, results);
  return NextResponse.json({ ok: true, date: y, results });
}
