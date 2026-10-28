import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchBlogMetrics, scoreBlog, type ReviewnoteInfo } from "@/lib/blogCheck";

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
  "id, store_id, status, campaign_id, title, offer, keywords, information, possible_days, possible_time, schedule_information, inf_num, macmini_note, macmini_at, approved_at, review_end_at, progress_synced_at";

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

  return NextResponse.json({ ok: true, stores: stores ?? [], rounds, selections, unchecked });
}

type IncomingApplicant = { blogId: string; name?: string | null; rn?: (ReviewnoteInfo & { applyId?: number | string }) | null };

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
          await supabase.from("recruit_applicants").update(patch).eq("id", hit.id);
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
      const becomesDone = round.status === "approved" && items.length > 0;
      const { error } = await supabase
        .from("recruit_rounds")
        .update({
          ...(becomesDone ? { status: "done" } : {}),
          ...(reviewEndAt ? { review_end_at: reviewEndAt } : {}),
          progress_synced_at: now,
          ...note(`체험 진행 ${items.length}명 · 리뷰 등록 ${reviewed}명 확인`),
        })
        .eq("id", round.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, matched, reviewed, done: becomesDone });
    }

    // 실패 메모 (상태는 안 바꾼다 — 다음 주기에 다시 시도)
    case "error": {
      if (!round) return NextResponse.json({ error: "회차 없음" }, { status: 404 });
      const message = String(body.message ?? "알 수 없는 오류");
      await supabase.from("recruit_rounds").update(note(`오류: ${message}`)).eq("id", round.id);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
