import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchBlogMetrics, scoreBlog, type ReviewnoteInfo } from "@/lib/blogCheck";
import { sendPush } from "@/lib/webpush";
import type { RecruitRoundStatus } from "@/lib/types";

// 맥미니 체험단 작업기가 부르는 API.
//   GET  → 할 일 목록: 리뷰노트에 올릴 회차(confirmed), 지원자를 가져올 회차(registered/selecting),
//          선정을 반영할 회차(approved)와 그 회차의 선정자 applyId.
//   POST → 결과 보고: registered / import / check / done / error
// 인증: Vault의 cron_secret(맥미니 .env의 MACMINI_TOKEN) 또는 Vercel CRON_SECRET.
// 사람 로그인 없이 서비스 키로 쓰므로, 이 라우트 밖에선 절대 서비스 키를 쓰지 않는다.

type Supa = ReturnType<typeof createServiceClient>;

async function authorized(request: Request, supabase: Supa): Promise<boolean> {
  const authHeader = request.headers.get("authorization") ?? "";
  const { data: dbToken } = await supabase.rpc("attendance_cron_token");
  const accepted = [process.env.CRON_SECRET, dbToken].filter(
    (t): t is string => typeof t === "string" && t.length > 0
  );
  return accepted.length > 0 && accepted.some((t) => authHeader === `Bearer ${t}`);
}

const ROUND_COLS =
  "id, store_id, status, campaign_id, title, offer, keywords, information, possible_days, possible_time, schedule_information, inf_num, macmini_note, macmini_at, approved_at, review_end_at, progress_synced_at, booking_token";

// 선정 안내 문자는 이 시각 이후에 선정 승인된 회차부터 보낸다.
// (기능을 켜기 전부터 진행 중이던 회차의 선정자에게 뒤늦게 문자가 가지 않도록)
const NOTIFY_SINCE = "2026-11-01T10:00:00.000Z";

export async function GET(request: Request) {
  const supabase = createServiceClient();
  if (!(await authorized(request, supabase))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // done(선정 끝) 회차도 리뷰 마감 + 7일까지는 리뷰 등록 현황을 계속 맞춘다.
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: stores }, { data: active, error }, { data: finished }] = await Promise.all([
    supabase.from("stores").select("id, name"),
    supabase
      .from("recruit_rounds")
      .select(ROUND_COLS)
      .in("status", ["confirmed", "registered", "selecting", "approved"])
      .order("created_at"),
    supabase
      .from("recruit_rounds")
      .select(ROUND_COLS)
      .eq("status", "done")
      .or(`review_end_at.is.null,review_end_at.gte.${cutoff}`)
      .order("created_at"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rounds = [...(active ?? []), ...(finished ?? [])];

  // 선정 승인된 회차의 선정자 (리뷰노트 applyId 포함)
  const approved = rounds.filter((r) => r.status === "approved" && r.campaign_id);
  const selections: Record<string, { apply_id: string | null; blog_id: string; name: string | null }[]> = {};
  for (const r of approved) {
    const { data: rows } = await supabase
      .from("recruit_applicants")
      .select("blog_id, applicant_name, rn, apply_id, selected")
      .eq("store_id", r.store_id)
      .eq("campaign_id", r.campaign_id!)
      .eq("selected", true);
    selections[r.id] = (rows ?? []).map((a) => ({
      apply_id: a.apply_id ?? ((a.rn as ReviewnoteInfo | null)?.applyId != null ? String((a.rn as ReviewnoteInfo).applyId) : null),
      blog_id: a.blog_id,
      name: a.applicant_name,
    }));
  }

  // 지원자 가져오기 대상 회차는 "아직 점수 안 매긴 지원자"도 같이 알려준다(작업기가 check를 돌림).
  const unchecked: Record<string, string[]> = {};
  for (const r of rounds.filter((x) => (x.status === "registered" || x.status === "selecting") && x.campaign_id)) {
    const { data: rows } = await supabase
      .from("recruit_applicants")
      .select("id")
      .eq("store_id", r.store_id)
      .eq("campaign_id", r.campaign_id!)
      .is("checked_at", null)
      .limit(200);
    unchecked[r.id] = (rows ?? []).map((x) => x.id);
  }

  // 선정 안내 문자 보낼 사람: 리뷰노트 반영이 끝난(done) 회차의 선정자 중 아직 안 보낸 사람.
  // 번호는 앱에 없으니 작업기가 리뷰노트 진행 목록에서 applyId로 찾아 보낸다.
  const notify: Record<string, { id: string; apply_id: string | null; blog_id: string; name: string | null }[]> = {};
  for (const r of rounds.filter((x) => x.status === "done" && x.campaign_id && x.approved_at && x.approved_at >= NOTIFY_SINCE)) {
    const { data: rows } = await supabase
      .from("recruit_applicants")
      .select("id, blog_id, applicant_name, apply_id")
      .eq("store_id", r.store_id)
      .eq("campaign_id", r.campaign_id!)
      .eq("selected", true)
      .eq("no_show", false)
      .is("notify_sent_at", null)
      .limit(100);
    if (rows && rows.length > 0) {
      notify[r.id] = rows.map((a) => ({ id: a.id, apply_id: a.apply_id, blog_id: a.blog_id, name: a.applicant_name }));
    }
  }

  return NextResponse.json({ ok: true, stores: stores ?? [], rounds, selections, unchecked, notify });
}

type IncomingApplicant = { blogId: string; name?: string | null; rn?: (ReviewnoteInfo & { applyId?: number | string }) | null };

// 본사 대표 계정(매장 소속 없는 owner, 팀 소속 아님)에 푸시. 체험단 작업이 사람 손을 기다릴 때 쓴다.
async function notifyHqMasters(supabase: Supa, payload: { title: string; body: string; url: string }) {
  const { data: masters } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "owner")
    .is("store_id", null)
    .is("department", null)
    .eq("status", "approved");
  const ids = (masters ?? []).map((m) => m.id);
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

// 리뷰노트 캠페인 내용(제공 내역·키워드·모집글 본문·방문 가능 요일/시간·영업 안내)으로
// 회차의 "비어 있는" 칸만 채운다. 앱에서 쓴 글은 덮어쓰지 않는다 — 리뷰노트에서
// 가져온 회차(손으로 넣었거나 앱 밖에서 만든 것)가 '지난 회차' 바탕글로 쓰일 수 있게.
function fillFromCampaign(round: Record<string, unknown>, campaign: Record<string, unknown>) {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const patch: Record<string, unknown> = {};
  const put = (col: string, v: unknown) => {
    if (v != null && (round[col] == null || round[col] === "")) patch[col] = v;
  };
  put("title", str(campaign.title));
  put("offer", str(campaign.offer));
  put("information", str(campaign.information));
  put("possible_days", str(campaign.possibleDays));
  put("possible_time", str(campaign.possibleTime));
  put("schedule_information", str(campaign.scheduleInformation));
  const kws = [campaign.keyword1, campaign.keyword2, campaign.keyword3].map(str).filter((k): k is string => !!k);
  if (kws.length > 0 && (!Array.isArray(round.keywords) || (round.keywords as unknown[]).length === 0)) patch.keywords = kws;
  if (typeof campaign.infNum === "number" && campaign.infNum > 0 && !round.inf_num) patch.inf_num = campaign.infNum;
  return patch;
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  if (!(await authorized(request, supabase))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const now = new Date().toISOString();
  const note = (text: string) => ({ macmini_note: text.slice(0, 300), macmini_at: now, updated_at: now });

  const roundId = typeof body.roundId === "string" ? body.roundId : null;
  const { data: round } = roundId
    ? await supabase.from("recruit_rounds").select(ROUND_COLS).eq("id", roundId).maybeSingle()
    : { data: null };

  switch (body.action) {
    // 리뷰노트에 모집글(캠페인) 등록 완료 → 캠페인 번호 기록
    case "registered": {
      if (!round || round.status !== "confirmed") return NextResponse.json({ error: "회차 상태가 confirmed가 아니에요." }, { status: 409 });
      const campaignId = String(body.campaignId ?? "");
      if (!/^\d+$/.test(campaignId)) return NextResponse.json({ error: "campaignId" }, { status: 400 });
      const { error } = await supabase
        .from("recruit_rounds")
        .update({ status: "registered", campaign_id: campaignId, ...note(`리뷰노트 등록됨 (캠페인 ${campaignId})`) })
        .eq("id", round.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // 리뷰노트에서 읽어온 지원자 저장 (saveApplicants와 같은 규칙) → 회차는 selecting
    case "import": {
      if (!round || !round.campaign_id) return NextResponse.json({ error: "회차/캠페인 없음" }, { status: 409 });
      if (round.status !== "registered" && round.status !== "selecting") {
        return NextResponse.json({ error: `회차 상태(${round.status})에선 지원자를 가져오지 않아요.` }, { status: 409 });
      }
      const applicants = (Array.isArray(body.applicants) ? body.applicants : []) as IncomingApplicant[];
      const clean = applicants
        .map((a) => ({ ...a, blogId: String(a.blogId ?? "").trim().toLowerCase() }))
        .filter((a) => /^[a-z0-9_-]{3,30}$/.test(a.blogId))
        .slice(0, 300);
      const campaign = (body.campaign ?? {}) as Record<string, unknown>;
      if (clean.length > 0) {
        const rows = clean.map((a) => ({
          store_id: round.store_id,
          campaign_id: round.campaign_id!,
          campaign_title: typeof campaign.title === "string" ? campaign.title : round.title,
          blog_id: a.blogId,
          applicant_name: a.name ?? null,
          rn: a.rn ?? null,
          apply_id: a.rn?.applyId != null ? String(a.rn.applyId) : null,
        }));
        const { error } = await supabase.from("recruit_applicants").upsert(rows, { onConflict: "store_id,campaign_id,blog_id" });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const infNum = typeof campaign.infNum === "number" ? campaign.infNum : null;
      const { error: e2 } = await supabase
        .from("recruit_rounds")
        .update({
          status: "selecting",
          ...fillFromCampaign(round as unknown as Record<string, unknown>, campaign),
          ...(infNum ? { inf_num: infNum } : {}),
          ...note(`지원자 ${clean.length}명 가져옴`),
        })
        .eq("id", round.id);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
      return NextResponse.json({ ok: true, imported: clean.length });
    }

    // 지원자 한 명 블로그 점수 매기기 (checkApplicant와 같은 로직)
    case "check": {
      const applicantId = String(body.applicantId ?? "");
      const { data: row } = await supabase
        .from("recruit_applicants")
        .select("id, blog_id, rn")
        .eq("id", applicantId)
        .maybeSingle();
      if (!row) return NextResponse.json({ error: "지원자 없음" }, { status: 404 });
      const metrics = await fetchBlogMetrics(row.blog_id);
      const verdict = scoreBlog(metrics, row.rn as ReviewnoteInfo | null);
      const { error } = await supabase
        .from("recruit_applicants")
        .update({ metrics, score: verdict.score, grade: verdict.grade, flags: verdict.flags, checked_at: now })
        .eq("id", row.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, grade: verdict.grade, score: verdict.score });
    }

    // 리뷰노트에 선정 반영 완료 → done
    case "done": {
      if (!round || round.status !== "approved") return NextResponse.json({ error: "회차 상태가 approved가 아니에요." }, { status: 409 });
      const count = Number(body.selectedCount ?? 0);
      const { error } = await supabase
        .from("recruit_rounds")
        .update({ status: "done", ...note(`리뷰노트 선정 반영 완료 (${count}명)`) })
        .eq("id", round.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // 리뷰노트 '진행 중' 목록을 그대로 반영: 선정자 확정(selected), 리뷰 URL·등록 시각·키워드 순위.
    // 리뷰노트에서 이미 선정이 끝난 회차(approved인데 progress 목록이 있음)는 done으로 맞춘다.
    case "progress": {
      if (!round || !round.campaign_id) return NextResponse.json({ error: "회차/캠페인 없음" }, { status: 409 });
      const items = (Array.isArray(body.applies) ? body.applies : []) as {
        applyId: string | number;
        blogId: string | null;
        name?: string | null;
        status?: string | null;
        reviewUrl?: string | null;
        reviewAt?: string | null;
        ranks?: Record<string, number | null> | null;
        rn?: ReviewnoteInfo | null;
      }[];
      const reviewEndAt = typeof body.reviewEndAt === "string" ? body.reviewEndAt : null;
      const progressCampaign = (body.campaign ?? {}) as Record<string, unknown>;
      let matched = 0;
      for (const it of items) {
        const blogId = (it.blogId ?? "").trim().toLowerCase();
        const patch = {
          selected: true,
          apply_id: String(it.applyId),
          rn_status: it.status ?? null,
          review_url: it.reviewUrl ?? null,
          review_at: it.reviewAt ?? null,
          review_ranks: it.ranks ?? null,
        };
        // apply_id로 먼저, 없으면 블로그 아이디로 맞춘다. 둘 다 없으면 새로 만든다(앱 밖에서 선정된 사람).
        let { data: hit } = await supabase
          .from("recruit_applicants")
          .select("id")
          .eq("store_id", round.store_id)
          .eq("campaign_id", round.campaign_id)
          .eq("apply_id", String(it.applyId))
          .maybeSingle();
        if (!hit && blogId) {
          ({ data: hit } = await supabase
            .from("recruit_applicants")
            .select("id")
            .eq("store_id", round.store_id)
            .eq("campaign_id", round.campaign_id)
            .eq("blog_id", blogId)
            .maybeSingle());
        }
        if (hit) {
          // 리뷰노트가 주는 이름이 있으면 같이 채운다(앱엔 블로그 아이디만 있는 경우가 많다).
          await supabase
            .from("recruit_applicants")
            .update({ ...patch, ...(it.name ? { applicant_name: it.name } : {}) })
            .eq("id", hit.id);
          matched++;
        } else if (/^[a-z0-9_-]{3,30}$/.test(blogId)) {
          await supabase.from("recruit_applicants").insert({
            store_id: round.store_id,
            campaign_id: round.campaign_id,
            campaign_title: round.title,
            blog_id: blogId,
            applicant_name: it.name ?? null,
            rn: it.rn ?? null,
            ...patch,
          });
          matched++;
        }
      }
      const reviewed = items.filter((it) => it.reviewUrl).length;
      // 리뷰노트에 진행 목록이 있으면 선정은 이미 끝난 것. 앱에서 승인(approved)했든,
      // 앱 밖(리뷰노트)에서 직접 선정했든(selecting/registered 그대로인 경우) done으로 맞춘다.
      const becomesDone = ["approved", "selecting", "registered"].includes(round.status) && items.length > 0;
      const { error } = await supabase
        .from("recruit_rounds")
        .update({
          ...(becomesDone ? { status: "done" } : {}),
          ...fillFromCampaign(round as unknown as Record<string, unknown>, progressCampaign),
          ...(reviewEndAt ? { review_end_at: reviewEndAt } : {}),
          progress_synced_at: now,
          ...note(`체험 진행 ${items.length}명 · 리뷰 등록 ${reviewed}명 확인`),
        })
        .eq("id", round.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, matched, reviewed, done: becomesDone });
    }

    // 선정 안내 문자 발송 결과. 번호 전체는 받지 않고 뒷 4자리만 남긴다.
    case "notified": {
      if (!round) return NextResponse.json({ error: "회차 없음" }, { status: 404 });
      const results = (Array.isArray(body.results) ? body.results : []) as {
        applicantId: string;
        ok: boolean;
        to4?: string | null;
        error?: string | null;
      }[];
      let sent = 0;
      let failed = 0;
      for (const r of results) {
        if (typeof r.applicantId !== "string") continue;
        const to4 = typeof r.to4 === "string" ? r.to4.replace(/\D/g, "").slice(-4) : null;
        const { error } = await supabase
          .from("recruit_applicants")
          .update(
            r.ok
              ? { notify_sent_at: now, notify_error: null, notify_to: to4 }
              : { notify_error: String(r.error ?? "발송 실패").slice(0, 200), notify_to: to4 }
          )
          .eq("id", r.applicantId)
          .eq("store_id", round.store_id);
        if (error) continue;
        if (r.ok) sent++;
        else failed++;
      }
      if (sent > 0 || failed > 0) {
        await supabase
          .from("recruit_rounds")
          .update(note(`선정 안내 문자 ${sent}명 발송${failed ? ` · 실패 ${failed}명` : ""}`))
          .eq("id", round.id);
      }
      return NextResponse.json({ ok: true, sent, failed });
    }

    // 리뷰노트 계정에 있는 캠페인 목록을 작업기가 보내온다 → 앱에 없는 캠페인은 회차로 만들거나,
    // 앱에서 확정만 해 둔(리뷰노트 번호 없는) 회차에 연결한다. 점장이 리뷰노트에 직접 올려도
    // 앱이 알아서 따라오게 하는 길. 오래된 캠페인은 작업기 쪽에서 걸러서 보낸다.
    case "discover": {
      const storeId = typeof body.storeId === "string" ? body.storeId : null;
      if (!storeId) return NextResponse.json({ error: "storeId" }, { status: 400 });
      const campaigns = (Array.isArray(body.campaigns) ? body.campaigns : []) as (Record<string, unknown> & {
        id: string | number;
        status?: string | null;
        createdAt?: string | null;
        reviewEndAt?: string | null;
      })[];
      const appStatusFor = (rnStatus: string | null | undefined): RecruitRoundStatus =>
        rnStatus === "PROGRESS" || rnStatus === "COMPLETE" ? "done" : "registered";
      let linked = 0;
      let created = 0;
      for (const c of campaigns) {
        const campaignId = String(c.id ?? "");
        if (!/^\d+$/.test(campaignId)) continue;
        const { data: existing } = await supabase
          .from("recruit_rounds")
          .select("id")
          .eq("store_id", storeId)
          .eq("campaign_id", campaignId)
          .maybeSingle();
        if (existing) continue;
        const status = appStatusFor(c.status);
        const common = {
          campaign_id: campaignId,
          status,
          ...(typeof c.reviewEndAt === "string" ? { review_end_at: c.reviewEndAt } : {}),
          confirmed_at: now,
          ...note(`리뷰노트 캠페인 ${campaignId} 발견 → 자동 연결 (${c.status ?? "?"})`),
        };
        // 1) 앱에서 확정했지만 아직 번호가 없는 회차(가장 오래된 것부터) → 연결. 없으면 2) 쓰다 만 글(draft)이
        //    캠페인보다 먼저 만들어진 것 → 연결. 둘 다 없으면 3) 새 회차.
        const { data: waiting } = await supabase
          .from("recruit_rounds")
          .select("id, status, title, offer, keywords, information, possible_days, possible_time, schedule_information, inf_num, created_at")
          .eq("store_id", storeId)
          .is("campaign_id", null)
          .in("status", ["confirmed", "draft"])
          .order("created_at");
        const createdAtMs = typeof c.createdAt === "string" ? new Date(c.createdAt).getTime() : Date.now();
        const target =
          (waiting ?? []).find((r) => r.status === "confirmed") ??
          (waiting ?? []).find((r) => r.status === "draft" && new Date(r.created_at).getTime() <= createdAtMs);
        if (target) {
          const { error } = await supabase
            .from("recruit_rounds")
            .update({ ...common, ...fillFromCampaign(target as unknown as Record<string, unknown>, c) })
            .eq("id", target.id);
          if (!error) linked++;
        } else {
          const fields = fillFromCampaign({}, c);
          const { error } = await supabase.from("recruit_rounds").insert({
            store_id: storeId,
            ...fields,
            ...(fields.inf_num ? {} : { inf_num: 20 }),
            ...common,
          });
          if (!error) created++;
        }
      }
      return NextResponse.json({ ok: true, linked, created });
    }

    // 실패 메모 (상태는 안 바꾼다 — 다음 주기에 다시 시도)
    // 리뷰노트 로그인이 풀린 경우는 사람이 맥미니에서 다시 로그인해야만 풀리므로,
    // 처음 감지됐을 때(그리고 하루 넘게 계속되면 하루 한 번) 본사 대표 계정에 푸시로 알린다.
    case "error": {
      if (!round) return NextResponse.json({ error: "회차 없음" }, { status: 404 });
      const message = String(body.message ?? "알 수 없는 오류");
      const loginLost = message.includes("로그인 풀림");
      const prevNote = (round as { macmini_note?: string | null }).macmini_note ?? "";
      const prevAt = (round as { macmini_at?: string | null }).macmini_at;
      const prevWasSame = prevNote.includes("로그인 풀림");
      const prevAgeMs = prevAt ? Date.now() - new Date(prevAt).getTime() : Infinity;
      await supabase.from("recruit_rounds").update(note(`오류: ${message}`)).eq("id", round.id);
      if (loginLost && (!prevWasSame || prevAgeMs > 24 * 3600_000)) {
        const { data: storeRow } = await supabase.from("stores").select("name").eq("id", round.store_id).maybeSingle();
        await notifyHqMasters(supabase, {
          title: `리뷰노트 로그인 풀림 · ${storeRow?.name ?? ""}`.trim(),
          body: "맥미니에서 이 매장 리뷰노트에 다시 로그인해야 체험단 작업이 이어져요. 풀릴 때까지 30분마다 건너뜁니다.",
          url: "/recruit",
        });
      }
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
