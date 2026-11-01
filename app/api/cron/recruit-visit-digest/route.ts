import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPush } from "@/lib/webpush";
import { kstDateString } from "@/lib/date";

// Vercel Cron이 매일 10:00(KST, = 01:00 UTC)에 호출한다 (vercel.json 참고).
// 오늘 체험단 방문 예정이 있는 매장의 지점장·직원(승인된 그 매장 계정 전원)에게
// "오늘 체험단 N팀 · 12:30 한효정 2명 · …" 푸시를 보낸다. 방문 예정이 없는 매장은 조용히 넘어간다.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const supabase = createServiceClient();
  const { data: dbToken } = await supabase.rpc("attendance_cron_token");
  const accepted = [process.env.CRON_SECRET, dbToken].filter(
    (t): t is string => typeof t === "string" && t.length > 0
  );
  if (accepted.length === 0 || !accepted.some((t) => authHeader === `Bearer ${t}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = kstDateString(0);
  const from = new Date(`${today}T00:00:00+09:00`).toISOString();
  const to = new Date(`${today}T23:59:59.999+09:00`).toISOString();

  const { data: visits, error } = await supabase
    .from("recruit_applicants")
    .select("store_id, applicant_name, blog_id, visit_at, visit_party, visit_note")
    .eq("selected", true)
    .eq("no_show", false)
    .gte("visit_at", from)
    .lte("visit_at", to)
    .order("visit_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!visits || visits.length === 0) return NextResponse.json({ ok: true, stores: 0, sent: 0 });

  const byStore = new Map<string, typeof visits>();
  for (const v of visits) byStore.set(v.store_id, [...(byStore.get(v.store_id) ?? []), v]);
  const storeIds = [...byStore.keys()];

  const [{ data: stores }, { data: members }] = await Promise.all([
    supabase.from("stores").select("id, name, short_label").in("id", storeIds),
    supabase.from("profiles").select("id, store_id").in("store_id", storeIds).eq("status", "approved"),
  ]);
  const storeLabel = new Map((stores ?? []).map((s) => [s.id, s.short_label ?? s.name]));
  const usersByStore = new Map<string, string[]>();
  for (const m of members ?? []) {
    if (!m.store_id) continue;
    usersByStore.set(m.store_id, [...(usersByStore.get(m.store_id) ?? []), m.id]);
  }
  const allUserIds = [...new Set((members ?? []).map((m) => m.id))];
  const { data: subs } = allUserIds.length
    ? await supabase.from("push_subscriptions").select("*").in("user_id", allUserIds)
    : { data: [] };

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });

  let sent = 0;
  const expired: string[] = [];
  for (const [storeId, list] of byStore) {
    const userIds = new Set(usersByStore.get(storeId) ?? []);
    const targets = (subs ?? []).filter((s) => userIds.has(s.user_id));
    if (targets.length === 0) continue;
    const lines = list.map((v) => `${time(v.visit_at!)} ${v.applicant_name ?? v.blog_id}${v.visit_party ? ` ${v.visit_party}명` : ""}`);
    const payload = {
      title: `오늘 체험단 ${list.length}팀 · ${storeLabel.get(storeId) ?? ""}`.trim(),
      body: lines.slice(0, 6).join(" · ") + (lines.length > 6 ? ` 외 ${lines.length - 6}팀` : ""),
      url: "/",
    };
    await Promise.all(
      targets.map(async (s) => {
        const r = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
        if (r.sent) sent++;
        if (r.expired) expired.push(s.id);
      })
    );
  }
  if (expired.length) await supabase.from("push_subscriptions").delete().in("id", expired);

  return NextResponse.json({ ok: true, stores: byStore.size, visits: visits.length, sent });
}
