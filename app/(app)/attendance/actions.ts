"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  clampRadius,
  distanceMeters,
  evaluateAttendance,
} from "@/lib/geoAttendance";
import { kstDateAndMinutes, kstDateTimeToIso, matchShift } from "@/lib/attendanceSchedule";
import { resolveAttendanceNames } from "@/lib/attendanceNames";
import type { AttendanceType } from "@/lib/types";

export type AttendanceInput = {
  /** 기기에서 만든 멱등 키. 재전송돼도 같은 기록 하나만 남는다. */
  client_record_id: string;
  type: AttendanceType;
  /** 버튼을 누른 기기 시각(ISO). */
  recorded_at: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  device_info?: string;
};

export type AttendanceResult =
  | {
      ok: true;
      record_id: string;
      distance_m: number;
      in_range: boolean;
      flagged: boolean;
      duplicate: boolean;
      /** 스케줄 대비 분 차이 (출근 +면 지각, 퇴근 −면 조퇴). 스케줄 없으면 null */
      diff_minutes: number | null;
    }
  | { ok: false; error: string };

const CLIENT_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

// 사양서 6장 POST /attendance. 클라이언트 판정은 UX용이고 여기서 매장 좌표로
// 거리를 다시 계산한다. 반경 밖이어도 기록은 남기고 flagged=true로 표시한다
// (현장에서 "눌렀는데 안 남았다"는 분쟁보다 관리자가 걸러 보는 쪽이 낫다).
export async function recordAttendance(input: AttendanceInput): Promise<AttendanceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  if (!CLIENT_ID_RE.test(input.client_record_id ?? "")) {
    return { ok: false, error: "기록 ID가 올바르지 않습니다." };
  }
  if (input.type !== "IN" && input.type !== "OUT") {
    return { ok: false, error: "출근/퇴근 구분이 올바르지 않습니다." };
  }
  const recordedAt = new Date(input.recorded_at);
  if (Number.isNaN(recordedAt.getTime())) {
    return { ok: false, error: "기록 시각이 올바르지 않습니다." };
  }
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  const accuracy = Math.round(Number(input.accuracy_m));
  if (
    !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(accuracy) ||
    Math.abs(lat) > 90 || Math.abs(lng) > 180 || accuracy < 0
  ) {
    return { ok: false, error: "위치 값이 올바르지 않습니다." };
  }

  // 멱등: 같은 client_record_id가 이미 있으면 그 기록을 그대로 돌려준다.
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id, distance_m, flagged, diff_minutes")
    .eq("client_record_id", input.client_record_id)
    .maybeSingle();
  if (existing) {
    return {
      ok: true,
      record_id: existing.id,
      distance_m: existing.distance_m,
      in_range: !existing.flagged,
      flagged: existing.flagged,
      duplicate: true,
      diff_minutes: existing.diff_minutes,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id, status, name")
    .eq("id", user.id)
    .single();
  if (!profile?.store_id || profile.status !== "approved") {
    return { ok: false, error: "소속 매장이 없는 계정은 출퇴근을 기록할 수 없어요." };
  }

  const { data: loc } = await supabase
    .from("store_locations")
    .select("*")
    .eq("store_id", profile.store_id)
    .maybeSingle();
  if (!loc) {
    return { ok: false, error: "매장 위치가 아직 설정되지 않았어요. 지점장님께 말씀해 주세요." };
  }

  const distance = Math.round(distanceMeters(lat, lng, loc.lat, loc.lng));
  const { inRange } = evaluateAttendance({
    distanceM: distance,
    accuracyM: accuracy,
    radiusM: loc.radius_m,
  });

  // 그날 스케줄과 비교해 지각/조퇴를 계산한다. 스케줄은 이름 글자로만 사람을
  // 구분하므로 계정 → 직원 이름 변환(resolveAttendanceNames)을 거친다.
  const { date: kstDate, minutes: recordedMinutes } = kstDateAndMinutes(recordedAt.toISOString());
  const [{ data: shifts }, resolved] = await Promise.all([
    supabase
      .from("schedule_shifts")
      .select("id, date, employee_name, start_time, end_time")
      .eq("store_id", profile.store_id)
      .eq("date", kstDate),
    resolveAttendanceNames(supabase, profile.store_id, [user.id]),
  ]);
  const names = Array.from(resolved.get(user.id)?.keys ?? [profile.name ?? ""]);
  const matched = matchShift(shifts ?? [], names, input.type, recordedMinutes);
  const scheduledAt = matched
    ? kstDateTimeToIso(kstDate, input.type === "IN" ? matched.shift.start_time : matched.shift.end_time)
    : null;

  const { data: inserted, error } = await supabase
    .from("attendance_records")
    .insert({
      client_record_id: input.client_record_id,
      user_id: user.id,
      store_id: profile.store_id,
      type: input.type,
      recorded_at: recordedAt.toISOString(),
      lat,
      lng,
      accuracy_m: accuracy,
      distance_m: distance,
      store_lat: loc.lat,
      store_lng: loc.lng,
      store_radius_m: loc.radius_m,
      flagged: !inRange,
      device_info: (input.device_info ?? "").slice(0, 200) || null,
      scheduled_at: scheduledAt,
      diff_minutes: matched ? matched.diffMinutes : null,
      shift_id: matched ? matched.shift.id : null,
    })
    .select("id")
    .single();

  if (error) {
    // 재전송 경합으로 유니크 충돌이 나면 기존 기록을 돌려준다.
    if (error.code === "23505") {
      const { data: dup } = await supabase
        .from("attendance_records")
        .select("id, distance_m, flagged, diff_minutes")
        .eq("client_record_id", input.client_record_id)
        .maybeSingle();
      if (dup) {
        return {
          ok: true,
          record_id: dup.id,
          distance_m: dup.distance_m,
          in_range: !dup.flagged,
          flagged: dup.flagged,
          duplicate: true,
          diff_minutes: dup.diff_minutes,
        };
      }
    }
    console.error("[attendance] insert failed", error);
    return { ok: false, error: "기록 저장에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/attendance");
  return {
    ok: true,
    record_id: inserted.id,
    distance_m: distance,
    in_range: inRange,
    flagged: !inRange,
    duplicate: false,
    diff_minutes: matched ? matched.diffMinutes : null,
  };
}

export type StoreLocationFormState = { error?: string; success?: boolean } | undefined;

// 관리자(본사 마스터·그 매장 지점장)가 매장 좌표·반경을 정한다. 바뀐 값은
// DB 트리거가 store_location_history에 "변경 전 값"으로 남긴다.
export async function saveStoreLocation(
  _prev: StoreLocationFormState,
  formData: FormData
): Promise<StoreLocationFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const storeId = String(formData.get("store_id") ?? "");
  const lat = Number(String(formData.get("lat") ?? "").trim());
  const lng = Number(String(formData.get("lng") ?? "").trim());
  const radius = clampRadius(Number(String(formData.get("radius_m") ?? "").trim()));
  const address = String(formData.get("address") ?? "").trim() || null;

  if (!storeId) return { error: "매장을 선택해 주세요." };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: "위도·경도 값이 올바르지 않습니다." };
  }

  const { error } = await supabase
    .from("store_locations")
    .upsert({ store_id: storeId, lat, lng, radius_m: radius, address }, { onConflict: "store_id" });

  if (error) {
    console.error("[attendance] store location save failed", error);
    return { error: "저장에 실패했어요. 권한이 있는 계정인지 확인해 주세요." };
  }

  revalidatePath("/attendance");
  revalidatePath("/attendance/settings");
  return { success: true };
}
