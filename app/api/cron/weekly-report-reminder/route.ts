import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPush } from "@/lib/webpush";
import { weekDatesKST } from "@/lib/date";

// Vercel Cron이 매주 일요일 KST 18:00에 호출한다 (vercel.json 참고).
// 이번 주(월~일) 주간보고를 아직 작성하지 않은 매장 계정에게 작성을
// 요청하는 알림을 보낸다.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const weekStart = weekDatesKST(0)[0];

  const [{ data: storeProfiles, error: profilesError }, { data: existingReports }] =
    await Promise.all([
      supabase.from("profiles").select("id, store_id").not("store_id", "is", null),
      supabase.from("weekly_reports").select("store_id").eq("week_start", weekStart),
    ]);

  if (profilesError) {
    console.error("[weekly-report-reminder] 대상 조회 실패", profilesError);
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const doneStoreIds = new Set((existingReports ?? []).map((r) => r.store_id));
  const targets = (storeProfiles ?? []).filter(
    (p) => p.store_id && !doneStoreIds.has(p.store_id)
  );

  console.log(`[weekly-report-reminder] 리마인드 대상 계정 ${targets.length}명`);

  const payload = {
    title: "주간보고 작성 요청",
    body: "이번 주 주간보고를 작성해 주세요.",
    url: "/weekly-report/write",
  };

  let sent = 0;
  for (const p of targets) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", p.id);
    if (!subs?.length) continue;

    const expiredIds: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        const { expired } = await sendPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          payload
        );
        if (expired) expiredIds.push(s.id);
        else sent++;
      })
    );

    if (expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }
  }

  console.log(`[weekly-report-reminder] ${sent}건 발송 완료`);
  return NextResponse.json({ targets: targets.length, sent });
}
