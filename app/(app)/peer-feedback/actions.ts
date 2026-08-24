"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PeerFeedbackFormState = { error?: string; success?: boolean } | undefined;

// 익명 동료 피드백 — 근무평가 점수/등급에는 반영되지 않는 참고용 자료.
// 같은 매장 사람끼리만(또는 HR팀) 낼 수 있고, 한 사람이 같은 동료를
// 같은 달에 두 번 낼 수 없다(RLS + DB 유니크 제약으로 이중 방지).
export async function submitPeerFeedback(
  _prevState: PeerFeedbackFormState,
  formData: FormData
): Promise<PeerFeedbackFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const employeeId = String(formData.get("employee_id") ?? "");
  const period = String(formData.get("period") ?? "");
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim();

  if (!employeeId || !period) return { error: "잘못된 요청입니다." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "평점을 선택해 주세요." };
  }

  const { error } = await supabase.from("peer_feedback").insert({
    employee_id: employeeId,
    period,
    rating,
    comment: comment || null,
    created_by: user.id,
  });

  if (error) {
    return { error: "이미 이번 분기에 피드백을 남기셨거나, 저장 중 오류가 발생했습니다." };
  }

  revalidatePath("/peer-feedback");
  revalidatePath(`/hr/eval/${employeeId}`);
  return { success: true };
}
