"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DamageCategory, DamageStatus } from "@/lib/types";

export type SimpleState = { error?: string; success?: boolean } | undefined;

// 매장 지문인식 근태를 월말에 직원별로 꽂는다.
// 같은 달을 다시 저장하면 덮어쓴다(월말에 한 번, 틀리면 고쳐 넣는 식).
export async function saveAttendance(
  _prevState: SimpleState,
  formData: FormData
): Promise<SimpleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "월을 올바르게 선택해 주세요." };

  const employeeIds = formData.getAll("employee_id").map(String);
  const rows: {
    employee_id: string;
    month: string;
    late_count: number;
    absent_count: number;
    unauthorized_count: number;
    created_by: string;
  }[] = [];

  for (const id of employeeIds) {
    const late = Number(formData.get(`late_${id}`) ?? 0);
    const absent = Number(formData.get(`absent_${id}`) ?? 0);
    const unauthorized = Number(formData.get(`unauth_${id}`) ?? 0);
    for (const [label, value] of [
      ["지각", late],
      ["결근", absent],
      ["무단결근", unauthorized],
    ] as const) {
      if (!Number.isInteger(value) || value < 0) {
        return { error: `${label} 횟수는 0 이상의 정수만 넣을 수 있습니다.` };
      }
    }
    rows.push({
      employee_id: id,
      month,
      late_count: late,
      absent_count: absent,
      unauthorized_count: unauthorized,
      created_by: user.id,
    });
  }

  if (rows.length === 0) return { error: "대상 직원이 없습니다." };

  const { error } = await supabase
    .from("employee_attendance")
    .upsert(rows, { onConflict: "employee_id,month" });

  if (error) return { error: "저장하지 못했습니다. 권한을 확인해 주세요." };

  revalidatePath("/hr");
  return { success: true };
}

// damage list 등재
export async function createDamageRecord(
  _prevState: SimpleState,
  formData: FormData
): Promise<SimpleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const storeId = String(formData.get("store_id") ?? "");
  const employeeId = String(formData.get("employee_id") ?? "");
  const itemName = String(formData.get("item_name") ?? "").trim();
  const category = String(formData.get("category") ?? "기물") as DamageCategory;
  const quantity = Number(formData.get("quantity") ?? 1);
  const reason = String(formData.get("reason") ?? "").trim();
  const occurredOn = String(formData.get("occurred_on") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();

  if (!storeId) return { error: "매장을 선택해 주세요." };
  if (!itemName) return { error: "품목명을 입력해 주세요." };
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { error: "수량은 1 이상이어야 합니다." };
  }

  const { error } = await supabase.from("damage_records").insert({
    store_id: storeId,
    // 원인이 특정되지 않는 건도 기록한다. 강등 판정은 직원이 지정된 건만 센다.
    employee_id: employeeId || null,
    item_name: itemName,
    category,
    quantity,
    reason: reason || null,
    ...(occurredOn ? { occurred_on: occurredOn } : {}),
    ...(amountRaw ? { amount: Number(amountRaw) } : {}),
    created_by: user.id,
  });

  if (error) return { error: "저장하지 못했습니다. 권한을 확인해 주세요." };

  revalidatePath("/hr");
  return { success: true };
}

export async function updateDamageStatus(
  id: string,
  status: DamageStatus,
  actionNote?: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("damage_records")
    .update({ status, ...(actionNote !== undefined ? { action_note: actionNote } : {}) })
    .eq("id", id);
  revalidatePath("/hr");
}

// 면담에서 합의한 다음 분기 목표와 중간 체크인을 저장한다.
export async function saveReviewNotes(
  _prevState: SimpleState,
  formData: FormData
): Promise<SimpleState> {
  const supabase = await createClient();

  const employeeId = String(formData.get("employee_id") ?? "");
  const period = String(formData.get("period") ?? "");
  const rubricKey = String(formData.get("rubric_key") ?? "");
  const kind = String(formData.get("kind") ?? "");

  if (!employeeId || !period || !rubricKey) return { error: "대상이 올바르지 않습니다." };

  const payload =
    kind === "midterm"
      ? {
          midterm_good: String(formData.get("midterm_good") ?? "").trim() || null,
          midterm_improve: String(formData.get("midterm_improve") ?? "").trim() || null,
          midterm_at: new Date().toISOString(),
        }
      : { next_goals: String(formData.get("next_goals") ?? "").trim() || null };

  const { error } = await supabase
    .from("performance_reviews")
    .upsert(
      { employee_id: employeeId, period, rubric_key: rubricKey, ...payload },
      { onConflict: "employee_id,period" }
    );

  if (error) return { error: "저장하지 못했습니다." };

  revalidatePath("/hr");
  return { success: true };
}
