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

type BatchAnchor = {
  id: string;
  date: string;
  batch_id: string | null;
  role: ScheduleRole;
  employee_name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  store_id: string;
};

// batch_id로 묶인 행이면 그 묶음 전체를, batch_id가 없는(2026-07-25 이전에
// 하루씩 개별 등록된) 행이면 같은 매장·직급·이름·근무시간으로 등록된
// 다른 batch_id 없는 행들을 같은 묶음으로 간주해서 반환한다.
async function findBatchRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  original: BatchAnchor
): Promise<{ id: string; date: string }[]> {
  if (original.batch_id) {
    const { data } = await supabase
      .from("schedule_shifts")
      .select("id, date")
      .eq("batch_id", original.batch_id);
    return data ?? [];
  }

  const { data } = await supabase
    .from("schedule_shifts")
    .select("id, date")
    .eq("store_id", original.store_id)
    .eq("employee_name", original.employee_name)
    .eq("role", original.role)
    .eq("start_time", original.start_time)
    .eq("end_time", original.end_time)
    .eq("break_minutes", original.break_minutes)
    .is("batch_id", null);
  return data ?? [];
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
    .select(
      "id, date, batch_id, role, employee_name, start_time, end_time, break_minutes, store_id"
    )
    .eq("id", shiftId)
    .maybeSingle();
  if (!original) return [];

  const rows = await findBatchRows(supabase, original);
  return rows.map((r) => r.date).sort();
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
    .select(
      "id, date, batch_id, role, employee_name, start_time, end_time, break_minutes, store_id"
    )
    .eq("id", id)
    .maybeSingle();
  if (!original) return { error: "잘못된 요청입니다." };

  const batchId = original.batch_id ?? crypto.randomUUID();
  const existing = await findBatchRows(supabase, original);

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

export type CellShiftState = { error?: string; success?: boolean } | undefined;

// 주간표에서 칸 하나(직원+날짜)를 바로 추가/수정하기 위한 단순 버전.
// addShift/updateShift는 여러 날짜를 한 번에 묶는 배치(batch_id) 로직이
// 있어서, 주간표처럼 칸 하나만 바로 고칠 때 쓰기엔 맞지 않는다.
export async function saveCellShift(
  _prevState: CellShiftState,
  formData: FormData
): Promise<CellShiftState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const id = String(formData.get("id") ?? "").trim() || null;
  const date = String(formData.get("date") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  const employeeName = String(formData.get("employee_name") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const breakMinutes = Number(formData.get("break_minutes") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "날짜가 올바르지 않습니다." };
  if (!SCHEDULE_ROLES.includes(roleRaw as ScheduleRole)) {
    return { error: "직급을 선택해 주세요." };
  }
  if (!employeeName) return { error: "이름을 입력해 주세요." };
  if (!startTime || !endTime) return { error: "근무 시간을 입력해 주세요." };
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return { error: "휴게시간을 올바르게 입력해 주세요." };
  }

  const { storeId } = await getStoreContext(supabase);
  const payload = {
    store_id: storeId,
    date,
    role: roleRaw as ScheduleRole,
    employee_name: employeeName,
    start_time: startTime,
    end_time: endTime,
    break_minutes: breakMinutes,
    notes: notes || null,
  };

  const { error } = id
    ? await supabase
        .from("schedule_shifts")
        .update({ ...payload, updated_by: user.id })
        .eq("id", id)
    : await supabase.from("schedule_shifts").insert({ ...payload, created_by: user.id });

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(`/schedule/${date}`);
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

export type PresetFormState = { error?: string; success?: boolean } | undefined;

// 근무 빠른입력 프리셋(오픈조/미들조/마감조 등) 추가/수정.
export async function savePreset(
  _prevState: PresetFormState,
  formData: FormData
): Promise<PresetFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const id = String(formData.get("id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const breakMinutes = Number(formData.get("break_minutes") ?? 0);

  if (!name) return { error: "이름을 입력해 주세요." };
  if (!startTime || !endTime) return { error: "근무 시간을 입력해 주세요." };
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return { error: "휴게시간을 올바르게 입력해 주세요." };
  }

  const { storeId } = await getStoreContext(supabase);
  const payload = {
    store_id: storeId,
    name,
    start_time: startTime,
    end_time: endTime,
    break_minutes: breakMinutes,
  };

  const { error } = id
    ? await supabase
        .from("schedule_shift_presets")
        .update({ ...payload, updated_by: user.id })
        .eq("id", id)
    : await supabase.from("schedule_shift_presets").insert({ ...payload, created_by: user.id });

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/schedule");
  return { success: true };
}

export async function deletePreset(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("schedule_shift_presets").delete().eq("id", id);
  revalidatePath("/schedule");
}

// 주간표 명단에서 직원 한 명을 통째로 지운다(중복 입력/퇴사자 정리용).
// 별도 직원 마스터가 없어 명단이 schedule_shifts 이력에서 나오는 구조라,
// 이 매장에서 그 이름으로 등록된 근무 기록을 전부 지워야 명단에서도 사라진다.
export async function deleteEmployeeShifts(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const employeeName = String(formData.get("employee_name") ?? "").trim();
  if (!employeeName) return;

  const { storeId } = await getStoreContext(supabase);
  await supabase
    .from("schedule_shifts")
    .delete()
    .eq("store_id", storeId)
    .eq("employee_name", employeeName);

  revalidatePath("/schedule");
}
