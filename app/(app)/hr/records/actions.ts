"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { classifyEmployeeRecord } from "@/lib/claude";
import { evalItemsFor, normalizeEvalItem } from "@/lib/employeeRecords";
import type { EmployeeRecordKind, EmployeeTeam } from "@/lib/types";

export type RecordFormState = { error?: string; success?: boolean } | undefined;

const KINDS: EmployeeRecordKind[] = ["칭찬", "지적"];

export async function createEmployeeRecord(
  _prevState: RecordFormState,
  formData: FormData
): Promise<RecordFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const employeeId = String(formData.get("employee_id") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const occurredOn = String(formData.get("occurred_on") ?? "").trim();
  const manualItem = String(formData.get("eval_item") ?? "").trim();

  if (!employeeId) return { error: "직원을 선택해 주세요." };
  if (!KINDS.includes(kindRaw as EmployeeRecordKind)) {
    return { error: "칭찬/지적을 선택해 주세요." };
  }
  if (!body) return { error: "무슨 일이 있었는지 적어 주세요." };

  // 문항 태그는 사람이 고른 값이 있으면 그걸 쓰고, 없으면 AI가 붙인다.
  // AI 호출이 실패해도 기록 자체는 저장돼야 하므로 태그 없이 진행한다.
  const { data: employee } = await supabase
    .from("employees")
    .select("team")
    .eq("id", employeeId)
    .single();
  const team = (employee?.team ?? null) as EmployeeTeam | null;

  let evalItem = normalizeEvalItem(manualItem, team);
  let evalItemSource: "ai" | "manual" = "manual";

  if (!evalItem) {
    evalItemSource = "ai";
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const guessed = await classifyEmployeeRecord(body, evalItemsFor(team), apiKey);
        evalItem = normalizeEvalItem(guessed, team);
      } catch {
        evalItem = null;
      }
    }
  }

  const { error } = await supabase.from("employee_records").insert({
    employee_id: employeeId,
    kind: kindRaw as EmployeeRecordKind,
    body,
    // 비워두면 DB 기본값(오늘, KST)이 들어간다.
    ...(occurredOn ? { occurred_on: occurredOn } : {}),
    eval_item: evalItem,
    eval_item_source: evalItemSource,
    created_by: user.id,
  });

  if (error) {
    // RLS에 막히는 경우가 대부분이라 이유를 구체적으로 알려준다.
    return {
      error:
        "저장하지 못했습니다. 기록 권한이 없거나(자기보다 위 직급, 본인) 계정이 직원 명부와 연결되지 않았을 수 있습니다.",
    };
  }

  revalidatePath("/hr");
  return { success: true };
}

// 면담에서 지적을 본인에게 공개할 때 쓴다. 칭찬은 저장 즉시 공개라 대상이 아니다.
export async function shareRecordWithEmployee(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("employee_records")
    .update({ shared_with_employee: true })
    .eq("id", id);
  revalidatePath("/hr");
}

// 24시간 안에 작성자 본인만 지울 수 있다(그 뒤는 DB 정책이 막는다).
export async function deleteEmployeeRecord(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("employee_records").delete().eq("id", id);
  revalidatePath("/hr");
}

// 직원 명부 row에 로그인 계정을 연결한다. 연결돼야 부점장·팀장이 기록을
// 남길 수 있고, 본인이 자기 칭찬을 볼 수 있다.
export async function linkEmployeeAccount(
  employeeId: string,
  userId: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ user_id: userId })
    .eq("id", employeeId);

  if (error) {
    return { error: "연결하지 못했습니다. 이미 다른 직원에게 연결된 계정일 수 있습니다." };
  }

  revalidatePath("/hr");
  return {};
}
