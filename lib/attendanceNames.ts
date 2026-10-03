import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeName } from "@/lib/attendanceSchedule";
import type { Database } from "@/lib/types";

export type ResolvedName = {
  /** 화면에 보여줄 이름 (직원 리스트 이름 우선) */
  display: string;
  /** 스케줄러 employee_name과 맞춰볼 이름들 (공백 제거) */
  keys: Set<string>;
};

/**
 * 계정 → 스케줄러에 적힌 이름을 찾는다.
 * - 기본: 프로필 이름
 * - HR 직원 리스트에서 계정을 연결해 뒀으면 그 직원 이름
 * - 지점장(role=owner) 계정은 이름이 "제이드앤워터 옥수본점"처럼 매장명이라
 *   스케줄의 "이승창"과 절대 안 맞는다 → 그 매장 직원 리스트의 '점장'이 한 명이면
 *   그 사람으로 본다.
 */
export async function resolveAttendanceNames(
  supabase: SupabaseClient<Database>,
  storeId: string,
  userIds: string[]
): Promise<Map<string, ResolvedName>> {
  const result = new Map<string, ResolvedName>();
  if (userIds.length === 0) return result;

  const [{ data: profiles }, { data: employees }] = await Promise.all([
    supabase.from("profiles").select("id, name, role, store_id").in("id", userIds),
    supabase
      .from("employees")
      .select("name, position, user_id")
      .eq("store_id", storeId)
      .is("resigned_at", null),
  ]);

  const staff = employees ?? [];
  const storeManagers = staff.filter((e) => e.position === "점장");

  for (const p of profiles ?? []) {
    const keys = new Set<string>();
    let display = p.name ?? "";
    if (p.name) keys.add(normalizeName(p.name));

    const linked = staff.filter((e) => e.user_id === p.id);
    if (linked.length > 0) {
      display = linked[0].name;
      for (const e of linked) keys.add(normalizeName(e.name));
    } else if (p.role === "owner" && p.store_id === storeId && storeManagers.length === 1) {
      display = storeManagers[0].name;
      keys.add(normalizeName(storeManagers[0].name));
    }

    result.set(p.id, { display, keys });
  }
  return result;
}
