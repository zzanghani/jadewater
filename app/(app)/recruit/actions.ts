"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchBlogMetrics, scoreBlog, type BlogMetrics, type ReviewnoteInfo } from "@/lib/blogCheck";

export type IncomingApplicant = { blogId: string; name?: string | null; rn?: ReviewnoteInfo | null };
export type IncomingCampaign = { id: string; title: string | null };

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

const COLS = "id, campaign_id, campaign_title, blog_id, applicant_name, rn, metrics, score, grade, flags, checked_at, created_at";

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
