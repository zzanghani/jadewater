"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { SCHEDULE_ROLES } from "@/lib/scheduleColors";
import { APP_ADMIN_PASSWORD } from "@/lib/appPassword";
import type { ScheduleRole } from "@/lib/types";

export type ScheduleFormState = { error?: string; success?: boolean } | undefined;
export type UnlockFormState = { error?: string; success?: boolean } | undefined;

function parseDatesField(formData: FormData, fallbackDate: string): string[] {
  let dates: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("dates_json") ?? "[]"));
    if (Array.isArray(parsed)) {
      dates = parsed.filter(
        (d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
      );
    }
  } catch {
    dates = [];
  }
  if (dates.length === 0 && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)) {
    dates = [fallbackDate];
  }
  return dates;
}

export async function unlockScheduleAdmin(
  _prevState: UnlockFormState,
  formData: FormData
): Promise<UnlockFormState> {
  const password = String(formData.get("password") ?? "");

  if (password !== APP_ADMIN_PASSWORD) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }

  return { success: true };
}

export async function addShift(
  _prevState: ScheduleFormState,
  formData: FormData
): Promise<ScheduleFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const date = String(formData.get("date") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  const employeeName = String(formData.get("employee_name") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const breakMinutes = Number(formData.get("break_minutes") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();

  const dates = parseDatesField(formData, date);

  if (dates.length === 0) return { error: "날짜를 선택해 주세요." };
  if (!SCHEDULE_ROLES.includes(roleRaw as ScheduleRole)) {
    return { error: "직급을 선택해 주세요." };
  }
  if (!employeeName) return { error: "이름을 입력해 주세요." };
  if (!startTime || !endTime) return { error: "근무 시간을 입력해 주세요." };
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return { error: "휴게시간을 올바르게 입력해 주세요." };
  }

  const { storeId } = await getStoreContext(supabase);

  const { error } = await supabase.from("schedule_shifts").insert(
    dates.map((d) => ({
      store_id: storeId,
      date: d,
      role: roleRaw as ScheduleRole,
      employee_name: employeeName,
      start_time: startTime,
      end_time: endTime,
      break_minutes: breakMinutes,
      notes: notes || null,
      created_by: user.id,
    }))
  );

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  for (const d of new Set(dates)) {
    revalidatePath(`/schedule/${d}`);
  }
  revalidatePath("/schedule");
  return { success: true };
}

export async function updateShift(
  _prevState: ScheduleFormState,
  formData: FormData
): Promise<ScheduleFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  const employeeName = String(formData.get("employee_name") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const breakMinutes = Number(formData.get("break_minutes") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();
  const dates = parseDatesField(formData, date);

  if (!id) return { error: "잘못된 요청입니다." };
  if (dates.length === 0) return { error: "날짜를 선택해 주세요." };
  if (!SCHEDULE_ROLES.includes(roleRaw as ScheduleRole)) {
    return { error: "직급을 선택해 주세요." };
  }
  if (!employeeName) return { error: "이름을 입력해 주세요." };
  if (!startTime || !endTime) return { error: "근무 시간을 입력해 주세요." };
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return { error: "휴게시간을 올바르게 입력해 주세요." };
  }

  // 팝업 달력에서 선택한 날짜 중 첫 번째는 기존 행의 날짜를 바꾸는 데 쓰고,
  // 추가로 더 선택한 날짜가 있으면 같은 내용으로 새 행을 만들어준다.
  const [primaryDate, ...extraDates] = dates;

  const { error: updateError } = await supabase
    .from("schedule_shifts")
    .update({
      date: primaryDate,
      role: roleRaw as ScheduleRole,
      employee_name: employeeName,
      start_time: startTime,
      end_time: endTime,
      break_minutes: breakMinutes,
      notes: notes || null,
      updated_by: user.id,
    })
    .eq("id", id);

  if (updateError) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  if (extraDates.length > 0) {
    const { storeId } = await getStoreContext(supabase);
    const { error: insertError } = await supabase.from("schedule_shifts").insert(
      extraDates.map((d) => ({
        store_id: storeId,
        date: d,
        role: roleRaw as ScheduleRole,
        employee_name: employeeName,
        start_time: startTime,
        end_time: endTime,
        break_minutes: breakMinutes,
        notes: notes || null,
        created_by: user.id,
      }))
    );
    if (insertError) {
      return { error: "일부 날짜 추가 중 오류가 발생했습니다." };
    }
  }

  for (const d of new Set([date, ...dates])) {
    revalidatePath(`/schedule/${d}`);
  }
  revalidatePath("/schedule");
  return { success: true };
}

export async function deleteShift(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!id) return;

  await supabase.from("schedule_shifts").delete().eq("id", id);

  if (date) revalidatePath(`/schedule/${date}`);
  revalidatePath("/schedule");
}
