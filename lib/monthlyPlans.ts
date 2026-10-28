import { createClient } from "@/lib/supabase/server";
import { avatarPublicUrl } from "@/lib/avatar";
import type { PlanComment, PlanFollower } from "@/components/MonthlyPlanDetail";
import type { Department, MonthlyPlan } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type HqProfile = { id: string; name: string; department: Department | null };

// 본사 담당자 목록: store_id가 비어있는 계정 = 본사 팀 계정(department 있음) + 마스터(role=owner).
// 가입 후 아직 매장을 선택하지 않은 직원(role=staff, department도 없음) 계정도
// store_id가 똑같이 비어있어서, 이 조건을 안 걸면 그 직원들까지 담당자 목록에 섞여 들어간다.
export async function loadHqProfiles(supabase: Supabase): Promise<HqProfile[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, name, department")
    .is("store_id", null)
    .eq("status", "approved")
    .or("department.not.is.null,role.eq.owner");
  return ((data ?? []) as HqProfile[]).sort((a, b) => (a.name === "대표님" ? -1 : b.name === "대표님" ? 1 : 0));
}

// 월간계획 전체 화면(/plan)용: 일정 + 댓글(첨부 서명 URL 포함) + 확인자 목록.
// 홈에서는 이걸 안 부르고 일정만 가볍게 읽는다(이번 주 띠).
export async function loadHqPlanData(supabase: Supabase): Promise<{
  monthlyPlans: MonthlyPlan[];
  commentsByPlan: Record<string, PlanComment[]>;
  followersByPlan: Record<string, PlanFollower[]>;
  hqProfiles: HqProfile[];
}> {
  let monthlyPlans: MonthlyPlan[] = [];
  let commentsByPlan: Record<string, PlanComment[]> = {};
  let followersByPlan: Record<string, PlanFollower[]> = {};
  let hqProfiles: HqProfile[] = [];
  const [{ data: plans }, profiles] = await Promise.all([
    supabase.from("monthly_plans").select("*").order("start_date", { ascending: true }),
    loadHqProfiles(supabase),
  ]);
  monthlyPlans = plans ?? [];
  hqProfiles = profiles;

  const planIds = monthlyPlans.map((p) => p.id);
  if (planIds.length > 0) {
    const { data: followerRows } = await supabase
      .from("monthly_plan_followers")
      .select("*")
      .in("plan_id", planIds);
    const hqNameById = new Map(hqProfiles.map((p) => [p.id, p.name]));
    followersByPlan = {};
    for (const f of followerRows ?? []) {
      const list = followersByPlan[f.plan_id] ?? [];
      list.push({ userId: f.user_id, name: hqNameById.get(f.user_id) ?? "알 수 없음", confirmed: f.confirmed });
      followersByPlan[f.plan_id] = list;
    }
  }
  if (planIds.length > 0) {
    const { data: comments } = await supabase
      .from("monthly_plan_comments")
      .select("*")
      .in("plan_id", planIds)
      .order("created_at", { ascending: true });
    const commentRows = comments ?? [];
    const commentIds = commentRows.map((c) => c.id);

    const [{ data: attachments }, { data: profiles }, { data: avatarProfiles }] = await Promise.all([
      commentIds.length > 0
        ? supabase.from("monthly_plan_attachments").select("*").in("comment_id", commentIds)
        : Promise.resolve({ data: [] as { id: string; comment_id: string; storage_path: string; file_name: string }[] }),
      supabase.from("profiles").select("id, name"),
      // avatar_path는 name과 별도 쿼리로 조회한다. 같은 select에 묶으면 마이그레이션
      // 전 환경에서는 쿼리 전체가 실패해서 이름 표시까지 깨진다.
      supabase.from("profiles").select("id, avatar_path"),
    ]);

    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));
    const avatarById = new Map(
      (avatarProfiles ?? []).map((p) => [p.id, avatarPublicUrl(p.avatar_path)])
    );

    const signedUrlByPath = new Map<string, string>();
    const downloadUrlByPath = new Map<string, string>();
    if ((attachments ?? []).length > 0) {
      const paths = (attachments ?? []).map((a) => a.storage_path);
      // 다운로드 버튼용 서명 URL은 따로 받는다 — Content-Disposition을
      // attachment로 붙여야 다른 도메인 URL이라도 진짜 다운로드로 동작한다.
      const [{ data: signedUrls }, { data: downloadSignedUrls }] = await Promise.all([
        supabase.storage.from("monthly-plans").createSignedUrls(paths, 3600),
        supabase.storage.from("monthly-plans").createSignedUrls(paths, 3600, { download: true }),
      ]);
      for (const s of signedUrls ?? []) {
        if (s.signedUrl) signedUrlByPath.set(s.path ?? "", s.signedUrl);
      }
      for (const s of downloadSignedUrls ?? []) {
        if (s.signedUrl) downloadUrlByPath.set(s.path ?? "", s.signedUrl);
      }
    }

    const attachmentsByComment = new Map<
      string,
      { id: string; file_name: string; url?: string; downloadUrl?: string }[]
    >();
    for (const a of attachments ?? []) {
      const list = attachmentsByComment.get(a.comment_id) ?? [];
      list.push({
        id: a.id,
        file_name: a.file_name,
        url: signedUrlByPath.get(a.storage_path),
        downloadUrl: downloadUrlByPath.get(a.storage_path),
      });
      attachmentsByComment.set(a.comment_id, list);
    }

    commentsByPlan = {};
    for (const c of commentRows) {
      const list = commentsByPlan[c.plan_id] ?? [];
      list.push({
        id: c.id,
        body: c.body,
        created_by: c.created_by,
        created_at: c.created_at,
        authorName: nameById.get(c.created_by) ?? "알 수 없음",
        authorAvatarUrl: avatarById.get(c.created_by),
        attachments: attachmentsByComment.get(c.id) ?? [],
      });
      commentsByPlan[c.plan_id] = list;
    }
  }
  return { monthlyPlans, commentsByPlan, followersByPlan, hqProfiles };
}
