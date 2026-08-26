"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { evalGrade, rubricFor, scoreRubric, isProbation } from "@/lib/evalRubric";
import type { EmployeeTeam, ScheduleRole } from "@/lib/types";

export type EvalFormState = { error?: string; success?: boolean } | undefined;

// 1차(점장) 또는 2차(부점장·팀장·SV) 채점을 저장한다.
// 2차 평가자에게는 1차 점수를 보여주지 않는다 — 따라 찍는 걸 막기 위해
// 화면에서 안 넘기고, 여기서도 상대 점수를 건드리지 않는다.
export async function saveEvalScores(
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
  const stage = String(formData.get("stage") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();

  if (!employeeId || !period) return { error: "대상이 올바르지 않습니다." };
  if (stage !== "first" && stage !== "second") return { error: "채점 단계가 올바르지 않습니다." };

  const { data: employee } = await supabase
    .from("employees")
    .select("position, team, hire_date")
    .eq("id", employeeId)
    .single();
  if (!employee) return { error: "직원을 찾을 수 없습니다." };

  const rubric = rubricFor(
    employee.position as ScheduleRole,
    (employee.team ?? null) as EmployeeTeam | null,
    isProbation(employee.hire_date)
  );
  if (!rubric) return { error: "이 직급은 아직 평가표가 없습니다." };

  const scores: Record<string, number> = {};
  let lowCount = 0;
  for (const item of rubric.items) {
    const raw = formData.get(`score_${item.id}`);
    if (raw === null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return { error: "점수는 1~5점만 넣을 수 있습니다." };
    }
    scores[item.id] = value;
    if (value <= 2) lowCount += 1;
  }

  const answered = Object.keys(scores).length;
  if (answered < rubric.items.length) {
    return { error: `${rubric.items.length - answered}개 문항이 남았습니다.` };
  }
  // 1·2점을 준 문항이 있으면 무슨 일이 있었는지 반드시 적게 한다.
  if (lowCount > 0 && !comment) {
    return { error: "2점 이하를 준 문항이 있습니다. 종합의견에 무슨 일이 있었는지 적어 주세요." };
  }

  const now = new Date().toISOString();
  const payload =
    stage === "first"
      ? {
          first_scores: scores,
          first_comment: comment || null,
          first_by: user.id,
          first_submitted_at: now,
        }
      : {
          second_scores: scores,
          second_comment: comment || null,
          second_by: user.id,
          second_submitted_at: now,
        };

  const { error } = await supabase
    .from("performance_reviews")
    .upsert(
      { employee_id: employeeId, period, rubric_key: rubric.key, ...payload },
      { onConflict: "employee_id,period" }
    );

  if (error) {
    return { error: "저장하지 못했습니다. 평가 권한이 없을 수 있습니다." };
  }

  revalidatePath("/hr");
  return { success: true };
}

// 1·2차가 모두 들어온 뒤 등급을 확정한다. 확정하면 총점·등급이 굳고
// 직원 본인에게도 보인다.
export async function finalizeEval(reviewId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: review } = await supabase
    .from("performance_reviews")
    .select("*")
    .eq("id", reviewId)
    .single();
  if (!review) return { error: "평가를 찾을 수 없습니다." };
  if (!review.first_submitted_at || !review.second_submitted_at) {
    return { error: "1차·2차 채점이 모두 끝나야 확정할 수 있습니다." };
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("position, team, hire_date")
    .eq("id", review.employee_id)
    .single();
  if (!employee) return { error: "직원을 찾을 수 없습니다." };

  const rubric = rubricFor(
    employee.position as ScheduleRole,
    (employee.team ?? null) as EmployeeTeam | null,
    isProbation(employee.hire_date)
  );
  if (!rubric) return { error: "평가표를 찾을 수 없습니다." };

  // 점장 70% + 2차 30% 가중평균을 문항 단위로 낸 뒤 100점으로 환산한다.
  const merged: Record<string, number> = {};
  for (const item of rubric.items) {
    const a = review.first_scores?.[item.id];
    const b = review.second_scores?.[item.id];
    if (typeof a === "number" && typeof b === "number") merged[item.id] = a * 0.7 + b * 0.3;
    else if (typeof a === "number") merged[item.id] = a;
    else if (typeof b === "number") merged[item.id] = b;
  }

  const { total } = scoreRubric(rubric, merged);
  const { grade } = evalGrade(total);

  const { error } = await supabase
    .from("performance_reviews")
    .update({ total_score: total, grade, finalized_at: new Date().toISOString() })
    .eq("id", reviewId);

  if (error) return { error: "확정하지 못했습니다." };

  revalidatePath("/hr");
  return {};
}
