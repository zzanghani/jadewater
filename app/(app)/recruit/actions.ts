"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchBlogMetrics, scoreBlog, type BlogMetrics, type ReviewnoteInfo } from "@/lib/blogCheck";
import { draftRecruitPost } from "@/lib/claude";
import type { RecruitRound } from "@/lib/types";

export type IncomingApplicant = { blogId: string; name?: string | null; rn?: ReviewnoteInfo | null };
// 리뷰노트 버튼이 보내는 캠페인 정보. 모집글 항목도 같이 오면 다음 회차 초안의 바탕이 된다.
export type IncomingCampaign = {
  id: string;
  title: string | null;
  infNum?: number | null;
  offer?: string | null;
  keywords?: string[] | null;
  information?: string | null;
  possibleDays?: string | null;
  possibleTime?: string | null;
  scheduleInformation?: string | null;
};
export type RoundFields = Pick<
  RecruitRound,
  "title" | "offer" | "keywords" | "information" | "possible_days" | "possible_time" | "schedule_information" | "inf_num"
>;

export type ApplicantRow = {
  id: string;
  campaign_id: string;
  campaign_title: string | null;
  blog_id: string;
  applicant_name: string | null;
  rn: ReviewnoteInfo | null;
  metrics: BlogMetrics | null;
  score: number | null;
  grade: string | null;
  flags: string[];
  checked_at: string | null;
  selected: boolean;
  created_at: string;
};

type Supa = Awaited<ReturnType<typeof createClient>>;

// 지점장(자기 매장)·본사 마스터만. 직원·본사 팀 계정은 안 된다.
async function authStore(storeId: string): Promise<{ error: string } | { supabase: Supa; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { data: p } = await supabase.from("profiles").select("role, store_id, department, status").eq("id", user.id).maybeSingle();
  if (!p || p.status !== "approved" || p.department || p.role !== "owner" || (p.store_id && p.store_id !== storeId)) {
    return { error: "이 매장의 체험단 검증을 볼 권한이 없어요." };
  }
  return { supabase, userId: user.id };
}

const COLS = "id, campaign_id, campaign_title, blog_id, applicant_name, rn, metrics, score, grade, flags, checked_at, selected, created_at";

export async function loadApplicants(storeId: string): Promise<{ ok: true; rows: ApplicantRow[] } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if ("error" in auth) return { ok: false, error: auth.error };
  // 최근 모집 몇 회분만 (2주 단위라 넉넉히 500명).
  const { data, error } = await auth.supabase
    .from("recruit_applicants")
    .select(COLS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as unknown as ApplicantRow[] };
}

/** 지원자 목록을 저장한다(이미 있으면 리뷰노트 값만 갱신). 검사는 checkApplicant로 한 명씩. */
export async function saveApplicants(
  storeId: string,
  campaign: IncomingCampaign,
  applicants: IncomingApplicant[]
): Promise<{ ok: true; rows: ApplicantRow[] } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if ("error" in auth) return { ok: false, error: auth.error };
  const clean = applicants
    .map((a) => ({ ...a, blogId: a.blogId.trim().toLowerCase() }))
    .filter((a) => /^[a-z0-9_-]{3,30}$/.test(a.blogId));
  if (clean.length === 0) return { ok: false, error: "네이버 블로그 주소를 찾지 못했어요." };
  if (clean.length > 300) return { ok: false, error: "한 번에 300명까지만 확인할 수 있어요." };

  const rows = clean.map((a) => ({
    store_id: storeId,
    campaign_id: campaign.id,
    campaign_title: campaign.title,
    blog_id: a.blogId,
    applicant_name: a.name ?? null,
    rn: a.rn ?? null,
    created_by: auth.userId,
  }));
  const { data, error } = await auth.supabase
    .from("recruit_applicants")
    .upsert(rows, { onConflict: "store_id,campaign_id,blog_id" })
    .select(COLS);
  if (error) return { ok: false, error: error.message };

  // 리뷰노트에서 온 캠페인이면 회차로도 기록한다(선정 인원·모집글 보관).
  if (!campaign.id.startsWith("manual-")) {
    const { data: existing } = await auth.supabase
      .from("recruit_rounds")
      .select("id, status")
      .eq("store_id", storeId)
      .eq("campaign_id", campaign.id)
      .maybeSingle();
    const post = {
      title: campaign.title,
      offer: campaign.offer ?? null,
      keywords: (campaign.keywords ?? []).filter(Boolean),
      information: campaign.information ?? null,
      possible_days: campaign.possibleDays ?? null,
      possible_time: campaign.possibleTime ?? null,
      schedule_information: campaign.scheduleInformation ?? null,
      ...(campaign.infNum ? { inf_num: campaign.infNum } : {}),
    };
    if (existing) {
      const keep = existing.status === "approved" || existing.status === "done";
      await auth.supabase
        .from("recruit_rounds")
        .update({ ...post, ...(keep ? {} : { status: "selecting" as const }), updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await auth.supabase
        .from("recruit_rounds")
        .insert({ store_id: storeId, campaign_id: campaign.id, status: "selecting", created_by: auth.userId, ...post });
    }
  }
  return { ok: true, rows: (data ?? []) as unknown as ApplicantRow[] };
}

/** 한 명의 블로그를 네이버에서 읽어 점수를 매기고 저장한다. */
export async function checkApplicant(
  storeId: string,
  rowId: string
): Promise<{ ok: true; row: ApplicantRow } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { data: row } = await auth.supabase
    .from("recruit_applicants")
    .select(COLS)
    .eq("id", rowId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!row) return { ok: false, error: "지원자를 찾지 못했어요." };

  const r = row as unknown as ApplicantRow;
  const metrics = await fetchBlogMetrics(r.blog_id);
  const verdict = scoreBlog(metrics, r.rn);
  const { data, error } = await auth.supabase
    .from("recruit_applicants")
    .update({ metrics, score: verdict.score, grade: verdict.grade, flags: verdict.flags, checked_at: new Date().toISOString() })
    .eq("id", rowId)
    .select(COLS)
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data as unknown as ApplicantRow };
}

export async function deleteCampaign(storeId: string, campaignId: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await authStore(storeId);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { error } = await auth.supabase.from("recruit_applicants").delete().eq("store_id", storeId).eq("campaign_id", campaignId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ─── 모집 회차(모집글) ──────────────────────────────────────────────

export async function loadRounds(storeId: string): Promise<{ ok: true; rounds: RecruitRound[] } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { data, error } = await auth.supabase
    .from("recruit_rounds")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rounds: (data ?? []) as RecruitRound[] };
}

/** 모집글 저장. confirm=true면 확정(맥미니가 리뷰노트에 등록할 대기열로). */
export async function saveRound(
  storeId: string,
  roundId: string | null,
  fields: RoundFields,
  opts: { confirm?: boolean; aiDrafted?: boolean } = {}
): Promise<{ ok: true; round: RecruitRound } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if ("error" in auth) return { ok: false, error: auth.error };
  const keywords = fields.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 3);
  if (opts.confirm) {
    if (!fields.title?.trim() || !fields.offer?.trim()) return { ok: false, error: "체험단 이름과 제공 내역은 꼭 넣어 주세요." };
    if (keywords.length === 0) return { ok: false, error: "키워드를 1개 이상 넣어 주세요." };
    if (!fields.inf_num || fields.inf_num < 1) return { ok: false, error: "모집 인원을 넣어 주세요." };
  }
  const now = new Date().toISOString();
  const row = {
    ...fields,
    keywords,
    status: opts.confirm ? ("confirmed" as const) : ("draft" as const),
    confirmed_at: opts.confirm ? now : null,
    updated_at: now,
    ...(opts.aiDrafted !== undefined ? { ai_drafted: opts.aiDrafted } : {}),
  };
  if (roundId) {
    const { data: cur } = await auth.supabase.from("recruit_rounds").select("status").eq("id", roundId).eq("store_id", storeId).maybeSingle();
    if (!cur) return { ok: false, error: "모집글을 찾지 못했어요." };
    if (cur.status !== "draft" && cur.status !== "confirmed") return { ok: false, error: "이미 리뷰노트에 올라간 모집글은 여기서 고칠 수 없어요." };
    const { data, error } = await auth.supabase.from("recruit_rounds").update(row).eq("id", roundId).select("*").single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, round: data as RecruitRound };
  }
  const { data, error } = await auth.supabase
    .from("recruit_rounds")
    .insert({ ...row, store_id: storeId, created_by: auth.userId })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, round: data as RecruitRound };
}

export async function deleteRound(storeId: string, roundId: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await authStore(storeId);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { error } = await auth.supabase
    .from("recruit_rounds")
    .delete()
    .eq("id", roundId)
    .eq("store_id", storeId)
    .in("status", ["draft", "confirmed"]);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** 지난 모집글과 지난 회차 지원자 결과를 바탕으로 AI가 키워드·작성 가이드 초안을 쓴다. */
export async function draftPostWithAI(
  storeId: string,
  fields: RoundFields
): Promise<{ ok: true; keywords: string[]; information: string } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if ("error" in auth) return { ok: false, error: auth.error };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "AI 키가 설정돼 있지 않아요." };
  const [{ data: store }, { data: prev }] = await Promise.all([
    auth.supabase.from("stores").select("name").eq("id", storeId).maybeSingle(),
    auth.supabase
      .from("recruit_rounds")
      .select("keywords, information, created_at")
      .eq("store_id", storeId)
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  const r = await draftRecruitPost(
    {
      storeName: store?.name ?? fields.title ?? "",
      offer: fields.offer ?? "",
      currentKeywords: fields.keywords,
      currentInformation: fields.information ?? "",
      previous: (prev ?? []).map((p) => ({ keywords: p.keywords, information: p.information ?? "" })),
    },
    apiKey
  );
  if (!r) return { ok: false, error: "AI 초안을 만들지 못했어요. 잠시 후 다시 눌러 주세요." };
  return { ok: true, ...r };
}

// ─── 선정 승인 ──────────────────────────────────────────────────

/** 점장이 고른 사람만 선정으로 표시하고 회차를 '선정 승인'으로. 맥미니가 리뷰노트에 반영한다. */
export async function approveSelection(
  storeId: string,
  campaignId: string,
  applicantIds: string[]
): Promise<{ ok: true; round: RecruitRound } | { ok: false; error: string }> {
  const auth = await authStore(storeId);
  if ("error" in auth) return { ok: false, error: auth.error };
  if (campaignId.startsWith("manual-")) return { ok: false, error: "직접 붙여넣은 목록은 리뷰노트 캠페인이 아니라서 선정 승인을 할 수 없어요." };
  const { data: round } = await auth.supabase
    .from("recruit_rounds")
    .select("*")
    .eq("store_id", storeId)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (!round) return { ok: false, error: "이 캠페인의 회차 정보가 없어요. 리뷰노트에서 지원자를 다시 가져와 주세요." };
  if (round.status === "done") return { ok: false, error: "이미 리뷰노트에 선정이 끝난 회차예요." };
  if (applicantIds.length === 0) return { ok: false, error: "선정할 사람을 1명 이상 골라 주세요." };
  if (applicantIds.length > round.inf_num) return { ok: false, error: `모집 인원(${round.inf_num}명)보다 많이 골랐어요.` };

  const base = auth.supabase.from("recruit_applicants");
  const { error: e1 } = await base.update({ selected: false }).eq("store_id", storeId).eq("campaign_id", campaignId);
  if (e1) return { ok: false, error: e1.message };
  const { error: e2 } = await auth.supabase
    .from("recruit_applicants")
    .update({ selected: true })
    .eq("store_id", storeId)
    .eq("campaign_id", campaignId)
    .in("id", applicantIds);
  if (e2) return { ok: false, error: e2.message };
  const { data, error } = await auth.supabase
    .from("recruit_rounds")
    .update({ status: "approved", approved_by: auth.userId, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", round.id)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, round: data as RecruitRound };
}
