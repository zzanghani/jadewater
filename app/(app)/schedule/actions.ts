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
  const batchId = crypto.randomUUID();

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
      batch_id: batchId,
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

// 근무 하나가 여러 날짜를 한 번에 등록한 묶음(batch_id)에 속해 있으면
// 그 묶음에 포함된 모든 날짜를, 아니라면 자기 날짜 하나만 반환한다.
// 수정 폼을 열 때 팝업 달력에 기존에 체크돼 있던 날짜를 전부 보여주기 위해 쓴다.
export async function getShiftBatchDates(shiftId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data: original } = await supabase
    .from("schedule_shifts")
    .select("date, batch_id")
    .eq("id", shiftId)
    .maybeSingle();
  if (!original) return [];
  if (!original.batch_id) return [original.date];

  const { data: batchRows } = await supabase
    .from("schedule_shifts")
    .select("date")
    .eq("batch_id", original.batch_id)
    .order("date", { ascending: true });

  return (batchRows ?? []).map((r) => r.date);
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

  // 이 행이 한 번에 여러 날짜로 등록된 묶음(batch_id)에 속해 있으면
  // 팝업 달력에서 다시 고른 날짜 집합과 기존 묶음의 날짜 집합을 비교해서
  // 남긴 날짜는 내용만 수정하고, 뺀 날짜는 삭제, 새로 추가한 날짜는
  // 새 행으로 만든다. 묶음이 없던(예전에 하루씩 등록된) 행이면 이 시점에
  // 새 batch_id를 부여해서 이후로는 묶음으로 관리되게 한다.
  const { data: original } = await supabase
    .from("schedule_shifts")
    .select("id, date, batch_id")
    .eq("id", id)
    .maybeSingle();
  if (!original) return { error: "잘못된 요청입니다." };

  const batchId = original.batch_id ?? crypto.randomUUID();

  let existing: { id: string; date: string }[];
  if (original.batch_id) {
    const { data } = await supabase
      .from("schedule_shifts")
      .select("id, date")
      .eq("batch_id", original.batch_id);
    existing = data ?? [];
  } else {
    existing = [{ id: original.id, date: original.date }];
  }

  const desiredSet = new Set(dates);
  const existingByDate = new Map(existing.map((r) => [r.date, r.id]));

  const commonFields = {
    role: roleRaw as ScheduleRole,
    employee_name: employeeName,
    start_time: startTime,
    end_time: endTime,
    break_minutes: breakMinutes,
    notes: notes || null,
    batch_id: batchId,
    updated_by: user.id,
  };

  const toUpdateIds = existing.filter((r) => desiredSet.has(r.date)).map((r) => r.id);
  if (toUpdateIds.length > 0) {
    const { error } = await supabase
      .from("schedule_shifts")
      .update(commonFields)
      .in("id", toUpdateIds);
    if (error) {
      return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    }
  }

  const toDeleteIds = existing.filter((r) => !desiredSet.has(r.date)).map((r) => r.id);
  if (toDeleteIds.length > 0) {
    await supabase.from("schedule_shifts").delete().in("id", toDeleteIds);
  }

  const newDates = dates.filter((d) => !existingByDate.has(d));
  if (newDates.length > 0) {
    const { storeId } = await getStoreContext(supabase);
    const { error } = await supabase.from("schedule_shifts").insert(
      newDates.map((d) => ({
        store_id: storeId,
        date: d,
        created_by: user.id,
        ...commonFields,
      }))
    );
    if (error) {
      return { error: "일부 날짜 추가 중 오류가 발생했습니다." };
    }
  }

  for (const d of new Set([date, ...dates, ...existing.map((r) => r.date)])) {
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
