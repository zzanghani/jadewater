import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPush } from "@/lib/webpush";
import { kstDateString, shiftDateString } from "@/lib/date";

// Vercel Cron이 매일 KST 06:00에 호출한다 (vercel.json 참고).
// 시작일이 D-3인 월간계획을 찾아, 본사(마스터+팀 계정) 전원에게 알린다.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const targetDate = shiftDateString(kstDateString(0), 3);

  const [{ data: plans, error: plansError }, { data: hqProfiles }] = await Promise.all([
    supabase.from("monthly_plans").select("id, title, start_date").eq("start_date", targetDate),
    supabase.from("profiles").select("id").is("store_id", null),
  ]);

  if (plansError) {
    console.error("[monthly-plan-reminder] 일정 조회 실패", plansError);
    return NextResponse.json({ error: plansError.message }, { status: 500 });
  }

  if (!plans?.length || !hqProfiles?.length) {
    return NextResponse.json({ plans: plans?.length ?? 0, sent: 0 });
  }

  console.log(`[monthly-plan-reminder] D-3 일정 ${plans.length}건, 본사 계정 ${hqProfiles.length}명`);

  let sent = 0;
  for (const profile of hqProfiles) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", profile.id);
    if (!subs?.length) continue;

    for (const plan of plans) {
      const payload = {
        title: "월간계획 알림 (D-3)",
        body: `"${plan.title}" 일정이 3일 뒤(${plan.start_date}) 시작됩니다.`,
        url: "/",
      };

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
  }

  console.log(`[monthly-plan-reminder] ${sent}건 발송 완료`);
  return NextResponse.json({ plans: plans.length, sent });
}
