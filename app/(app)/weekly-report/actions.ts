"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { WeeklySalesRow } from "@/lib/types";

export type WeeklyFormState = { error?: string } | undefined;

function parseStringArray(formData: FormData, field: string): string[] {
  const raw = String(formData.get(field) ?? "[]");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function parseSalesTable(formData: FormData): WeeklySalesRow[] {
  const raw = String(formData.get("sales_table_json") ?? "[]");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r.label === "string")
      .map((r) => ({
        label: r.label,
        lastWeek: String(r.lastWeek ?? ""),
        thisWeek: String(r.thisWeek ?? ""),
      }));
  } catch {
    return [];
  }
}

export async function saveWeeklyReport(
  _prevState: WeeklyFormState,
  formData: FormData
): Promise<WeeklyFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const storeId = String(formData.get("store_id") ?? "");
  const weekStart = String(formData.get("week_start") ?? "");
  if (!storeId || !weekStart) return { error: "잘못된 요청입니다." };

  const payload = {
    store_id: storeId,
    week_start: weekStart,
    goals: parseStringArray(formData, "goals_json"),
    hr_items: parseStringArray(formData, "hr_items_json"),
    sales_notes: parseStringArray(formData, "sales_notes_json"),
    sales_table: parseSalesTable(formData),
    issues: parseStringArray(formData, "issues_json"),
    kitchen_items: parseStringArray(formData, "kitchen_items_json"),
    hall_items: parseStringArray(formData, "hall_items_json"),
    updated_by: user.id,
  };

  const { data: existing } = await supabase
    .from("weekly_reports")
    .select("id")
    .eq("store_id", storeId)
    .eq("week_start", weekStart)
    .maybeSingle();

  let reportId: string;
  if (existing) {
    const { error } = await supabase
      .from("weekly_reports")
      .update(payload)
      .eq("id", existing.id);
    if (error) return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    reportId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("weekly_reports")
      .insert({ ...payload, created_by: user.id })
      .select()
      .single();
    if (error || !inserted) {
      return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    }
    reportId = inserted.id;
  }

  revalidatePath("/weekly-report");
  redirect(`/weekly-report/${reportId}`);
}
