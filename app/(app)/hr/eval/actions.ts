"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { evalRubricFor } from "@/lib/evalRubric";
import type { EmployeeTeam } from "@/lib/types";

export type EvalFormState = { error?: string; success?: boolean } | undefined;

export async function submitPerformanceReview(
  _prevState: EvalFormState,
  formData: FormData
): Promise<EvalFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const employeeId = String(formData.get("employee_id") ?? "");
  const period = String(formData.get("period") ?? "");
  const team = String(formData.get("team") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const evaluatorNote = String(formData.get("evaluator_note") ?? "").trim();

  if (!employeeId) return { error: "잘못된 요청입니다." };
  if (!period) return { error: "평가 대상 월이 없습니다." };
  if (team !== "홀" && team !== "키친") return { error: "잘못된 요청입니다." };

  const rubric = evalRubricFor(team as EmployeeTeam);
  const scores: Record<string, number> = {};
  for (const item of rubric) {
    const raw = Number(formData.get(`score_${item.id}`));
    if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
      return { error: `"${item.name}" 항목의 점수를 선택해 주세요.` };
    }
    scores[item.id] = raw;
  }
  const totalScore = Object.values(scores).reduce((sum, v) => sum + v, 0);

  const { error } = await supabase.from("performance_reviews").upsert(
    {
      employee_id: employeeId,
      period,
      team: team as EmployeeTeam,
      scores,
      total_score: totalScore,
      comment: comment || null,
      evaluator_note: evaluatorNote || null,
      created_by: user.id,
    },
    { onConflict: "employee_id,period" }
  );

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/hr");
  revalidatePath(`/hr/eval/${employeeId}`);
  return { success: true };
}

// 근무평가 점수/등급에는 반영되지 않는, 참고용 동료 피드백 한 건 추가.
export async function submitPeerFeedback(
  _prevState: EvalFormState,
  formData: FormData
): Promise<EvalFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const employeeId = String(formData.get("employee_id") ?? "");
  const period = String(formData.get("period") ?? "");
  const reviewerName = String(formData.get("reviewer_name") ?? "").trim();
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim();

  if (!employeeId || !period) return { error: "잘못된 요청입니다." };
  if (!reviewerName) return { error: "동료 이름을 입력해 주세요." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "평점을 선택해 주세요." };
  }

  const { error } = await supabase.from("peer_feedback").insert({
    employee_id: employeeId,
    period,
    reviewer_name: reviewerName,
    rating,
    comment: comment || null,
    created_by: user.id,
  });

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(`/hr/eval/${employeeId}`);
  return { success: true };
}
