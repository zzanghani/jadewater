import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPush } from "@/lib/webpush";
import { kstDateString } from "@/lib/date";
import { kstDateAndMinutes, nameMatches, timeToMinutes } from "@/lib/attendanceSchedule";
import { resolveAttendanceNames } from "@/lib/attendanceNames";

// Vercel Cron이 10분마다 호출한다 (vercel.json 참고).
// 오늘 스케줄러에 잡힌 근무자에게 출근 2시간 전 / 퇴근 1시간 전 푸시를 보낸다.
// 크론이 늦게 돌아도 놓치지 않게 "지난 20분 안에 도래한 알림"을 모두 보되,
// attendance_reminders에 남긴 발송 기록으로 중복은 막는다.
const START_LEAD_MIN = 120;
const END_LEAD_MIN = 60;
const CATCH_UP_WINDOW_MIN = 20;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = kstDateString(0);
  const { minutes: nowMin } = kstDateAndMinutes(new Date().toISOString());

  const { data: shifts, error } = await supabase
    .from("schedule_shifts")
    .select("id, store_id, employee_name, start_time, end_time")
    .eq("date", today);
  if (error) {
    console.error("[attendance-reminders] 스케줄 조회 실패", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 지금 보내야 할 (근무, 종류) 목록
  const due: { shift: NonNullable<typeof shifts>[number]; kind: "start" | "end"; at: number }[] = [];
  for (const s of shifts ?? []) {
    const startAt = timeToMinutes(s.start_time) - START_LEAD_MIN;
    const endAt = timeToMinutes(s.end_time) - END_LEAD_MIN;
    for (const [kind, at] of [["start", startAt], ["end", endAt]] as const) {
      if (at <= nowMin && at > nowMin - CATCH_UP_WINDOW_MIN) due.push({ shift: s, kind, at });
    }
  }
  if (due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, due: 0 });
  }

  // 매장별로 계정 → 이름을 풀어서 스케줄 이름과 맞춘다.
  const storeIds = Array.from(new Set(due.map((d) => d.shift.store_id)));
  const { data: storeRows } = await supabase.from("stores").select("id, name, short_label").in("id", storeIds);
  const storeLabel = new Map((storeRows ?? []).map((s) => [s.id, s.short_label ?? s.name]));
  const { data: storeUsers } = await supabase
    .from("profiles")
    .select("id, store_id")
    .in("store_id", storeIds)
    .eq("status", "approved");
  const usersByStore = new Map<string, string[]>();
  for (const u of storeUsers ?? []) {
    if (!u.store_id) continue;
    usersByStore.set(u.store_id, [...(usersByStore.get(u.store_id) ?? []), u.id]);
  }
  const resolvedByStore = new Map<string, Awaited<ReturnType<typeof resolveAttendanceNames>>>();
  for (const storeId of storeIds) {
    resolvedByStore.set(storeId, await resolveAttendanceNames(supabase, storeId, usersByStore.get(storeId) ?? []));
  }

  // 오늘 이미 찍은 출근/퇴근 — 이미 찍었으면 그 알림은 보낼 필요 없다.
  const dayStart = new Date(`${today}T00:00:00+09:00`).toISOString();
  const { data: todayRecords } = await supabase
    .from("attendance_records")
    .select("user_id, type")
    .gte("recorded_at", dayStart);
  const alreadyIn = new Set((todayRecords ?? []).filter((r) => r.type === "IN").map((r) => r.user_id));
  const alreadyOut = new Set((todayRecords ?? []).filter((r) => r.type === "OUT").map((r) => r.user_id));

  let sent = 0;
  let skipped = 0;
  for (const { shift, kind } of due) {
    const resolved = resolvedByStore.get(shift.store_id);
    if (!resolved) continue;
    const targets = Array.from(resolved.entries())
      .filter(([, who]) => Array.from(who.keys).some((k) => nameMatches(k, shift.employee_name)))
      .map(([userId]) => userId);
    if (targets.length === 0) {
      skipped++;
      continue;
    }

    const label = storeLabel.get(shift.store_id) ?? "매장";
    const hm = (t: string) => t.slice(0, 5);
    const payload =
      kind === "start"
        ? {
            title: `${label} 출근 2시간 전`,
            body: `오늘 ${hm(shift.start_time)} 출근이에요. 매장에 도착하면 앱에서 출근을 찍어주세요.`,
            url: "/attendance",
          }
        : {
            title: `${label} 퇴근 1시간 전`,
            body: `${hm(shift.end_time)} 퇴근 예정이에요. 퇴근할 때 앱에서 퇴근을 꼭 찍어주세요.`,
            url: "/attendance",
          };

    for (const userId of targets) {
      if (kind === "start" && alreadyIn.has(userId)) continue;
      if (kind === "end" && alreadyOut.has(userId)) continue;

      // 발송 기록을 먼저 남긴다 — 유니크 충돌이면 이미 보낸 것.
      const { error: markError } = await supabase
        .from("attendance_reminders")
        .insert({ shift_id: shift.id, user_id: userId, kind });
      if (markError) continue;

      const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
      if (!subs?.length) continue;
      const expiredIds: string[] = [];
      await Promise.all(
        subs.map(async (s) => {
          const { expired } = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
          if (expired) expiredIds.push(s.id);
          else sent++;
        })
      );
      if (expiredIds.length > 0) {
        await supabase.from("push_subscriptions").delete().in("id", expiredIds);
      }
    }
  }

  console.log(`[attendance-reminders] due=${due.length} sent=${sent} no-account=${skipped}`);
  return NextResponse.json({ ok: true, due: due.length, sent, skipped });
}
