"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isProbation, rubricFor } from "@/lib/evalRubric";
import type { EmployeeTeam, ScheduleRole } from "@/lib/types";

export type SelfReviewState = { error?: string; success?: boolean } | undefined;

// 직원 본인이 쓰는 자기평가.
// 점수에는 반영하지 않는다 — 반영하면 부풀린다. 면담에서
// "내가 본 나"와 "남이 본 나"의 차이를 보여주는 용도다.
export async function saveSelfScores(
  _prevState: SelfReviewState,
  formData: FormData
): Promise<SelfReviewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const period = String(formData.get("period") ?? "");
  if (!period) return { error: "분기가 올바르지 않습니다." };

  // 본인 명부 row — 계정이 연결돼 있어야 찾을 수 있다.
  const { data: employee } = await supabase
    .from("employees")
    .select("id, position, team, hire_date")
    .eq("user_id", user.id)
    .is("resigned_at", null)
    .maybeSingle();

  if (!employee) {
    return {
      error:
        "직원 명부와 계정이 아직 연결되지 않았습니다. 점장님께 계정 연결을 요청해 주세요.",
    };
  }

  const rubric = rubricFor(
    employee.position as ScheduleRole,
    (employee.team ?? null) as EmployeeTeam | null,
    isProbation(employee.hire_date)
  );
  if (!rubric) return { error: "아직 자기평가 대상이 아닙니다." };

  // 근태는 앱이 자동 산출하므로 자기평가에서 뺀다.
  const items = rubric.items.filter((i) => !i.auto);

  const scores: Record<string, number> = {};
  for (const item of items) {
    const raw = formData.get(`self_${item.id}`);
    if (raw === null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return { error: "점수는 1~5점만 넣을 수 있습니다." };
    }
    scores[item.id] = value;
  }

  const answered = Object.keys(scores).length;
  if (answered < items.length) {
    return { error: `${items.length - answered}개 문항이 남았습니다.` };
  }

  const { error } = await supabase.from("performance_reviews").upsert(
    {
      employee_id: employee.id,
      period,
      rubric_key: rubric.key,
      self_scores: scores,
      self_submitted_at: new Date().toISOString(),
    },
    { onConflict: "employee_id,period" }
  );

  if (error) {
    return { error: "저장하지 못했습니다. 이미 확정된 평가는 고칠 수 없습니다." };
  }

  revalidatePath("/my-review");
  return { success: true };
}
