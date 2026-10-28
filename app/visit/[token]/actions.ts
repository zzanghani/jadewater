"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { sendPush } from "@/lib/webpush";
import { extractBlogIds } from "@/lib/blogCheck";

// 선정된 블로거가 로그인 없이 방문 예약을 남기는 공개 폼의 서버 쪽.
// 토큰으로 회차를 찾고, 입력한 블로그가 그 회차 "선정자"일 때만 저장한다.
// 명단은 절대 내려주지 않는다 (추측으로 남의 예약을 바꾸지 못하게 블로그 아이디가 열쇠).

export type BookingState = { ok?: boolean; error?: string; summary?: string } | undefined;

export type BookingInfo = {
  storeName: string;
  campaignTitle: string | null;
  possibleDays: string | null;
  possibleTime: string | null;
  scheduleInformation: string | null;
  reviewEndAt: string | null;
};

export async function loadBookingInfo(token: string): Promise<BookingInfo | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const supabase = createServiceClient();
  const { data: round } = await supabase
    .from("recruit_rounds")
    .select("id, store_id, status, title, possible_days, possible_time, schedule_information, review_end_at")
    .eq("booking_token", token)
    .maybeSingle();
  if (!round || (round.status !== "approved" && round.status !== "done")) return null;
  const { data: store } = await supabase.from("stores").select("name").eq("id", round.store_id).maybeSingle();
  return {
    storeName: store?.name ?? "",
    campaignTitle: round.title,
    possibleDays: round.possible_days,
    possibleTime: round.possible_time,
    scheduleInformation: round.schedule_information,
    reviewEndAt: round.review_end_at,
  };
}

export async function submitBooking(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const token = String(formData.get("token") ?? "");
  const blogRaw = String(formData.get("blog") ?? "").trim();
  const nameRaw = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const party = Number(String(formData.get("party") ?? "").replace(/[^\d]/g, ""));
  const contact = String(formData.get("contact") ?? "").trim().slice(0, 40);
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);

  if (!/^[a-f0-9]{32}$/.test(token)) return { error: "링크가 올바르지 않아요." };
  const blogId = (extractBlogIds(blogRaw)[0] ?? blogRaw).toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_-]{3,30}$/.test(blogId)) return { error: "네이버 블로그 주소나 아이디를 적어 주세요." };
  const norm = (v: string) => v.replace(/\s+/g, "").toLowerCase();
  if (norm(nameRaw).length < 2) return { error: "리뷰노트에 등록한 이름을 적어 주세요." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "방문 날짜와 시간을 골라 주세요." };
  if (!party || party < 1 || party > 20) return { error: "인원을 1~20명 사이로 적어 주세요." };
  const visitAt = new Date(`${date}T${time}:00+09:00`);
  if (Number.isNaN(visitAt.getTime())) return { error: "방문 일시가 올바르지 않아요." };
  if (visitAt.getTime() < Date.now() - 60 * 60 * 1000) return { error: "이미 지난 시간이에요. 다시 골라 주세요." };

  const supabase = createServiceClient();
  const { data: round } = await supabase
    .from("recruit_rounds")
    .select("id, store_id, campaign_id, status, title, review_end_at")
    .eq("booking_token", token)
    .maybeSingle();
  if (!round || !round.campaign_id || (round.status !== "approved" && round.status !== "done")) {
    return { error: "지금은 예약을 받지 않는 회차예요. 매장에 문의해 주세요." };
  }
  if (round.review_end_at && visitAt.getTime() > new Date(round.review_end_at).getTime()) {
    return { error: "리뷰 마감일 이후예요. 마감 전 날짜로 골라 주세요." };
  }

  const { data: applicant } = await supabase
    .from("recruit_applicants")
    .select("id, applicant_name, visit_at")
    .eq("store_id", round.store_id)
    .eq("campaign_id", round.campaign_id)
    .eq("blog_id", blogId)
    .eq("selected", true)
    .maybeSingle();
  if (!applicant) return { error: "이번 체험단 선정 명단에서 이 블로그를 찾지 못했어요. 리뷰노트에 등록된 블로그 아이디로 다시 적어 주세요." };
  // 블로그 아이디는 공개 정보라, 리뷰노트에 등록된 이름까지 맞아야 받는다 (명단 밖 사람이 남의 아이디로 예약하는 걸 막음).
  if (applicant.applicant_name && norm(applicant.applicant_name) !== norm(nameRaw)) {
    return { error: "이름이 선정 명단과 달라요. 리뷰노트 프로필에 등록한 이름 그대로 적어 주세요." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("recruit_applicants")
    .update({
      visit_at: visitAt.toISOString(),
      visit_party: party,
      visit_note: note || null,
      visit_contact: contact || null,
      visit_source: "reviewer",
      visit_updated_at: now,
      no_show: false,
    })
    .eq("id", applicant.id);
  if (error) return { error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };

  const when = visitAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  // 매장 지점장에게 알림 (실패해도 예약 자체는 성공)
  notifyManagers(supabase, round.store_id, {
    title: `체험단 방문 예약${applicant.visit_at ? " 변경" : ""}`,
    body: `${applicant.applicant_name ?? blogId} · ${when} · ${party}명${note ? ` · ${note}` : ""}`,
    url: "/recruit",
  }).catch(() => {});

  return { ok: true, summary: `${when} · ${party}명` };
}

async function notifyManagers(
  supabase: ReturnType<typeof createServiceClient>,
  storeId: string,
  payload: { title: string; body: string; url: string }
) {
  const { data: managers } = await supabase
    .from("profiles")
    .select("id")
    .eq("store_id", storeId)
    .eq("role", "owner")
    .is("department", null)
    .eq("status", "approved");
  const ids = (managers ?? []).map((m) => m.id);
  if (ids.length === 0) return;
  const { data: subs } = await supabase.from("push_subscriptions").select("*").in("user_id", ids);
  const expired: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      const r = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
      if (r.expired) expired.push(s.id);
    })
  );
  if (expired.length) await supabase.from("push_subscriptions").delete().in("id", expired);
}
