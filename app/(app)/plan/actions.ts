"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PlanFormState = { error?: string; success?: boolean } | undefined;

export async function createMonthlyPlan(
  _prevState: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const title = String(formData.get("title") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const color = String(formData.get("color") ?? "#2f7a63");

  if (!title) return { error: "제목을 입력해 주세요." };
  if (!startDate || !endDate) return { error: "기간을 선택해 주세요." };
  if (endDate < startDate) return { error: "종료일이 시작일보다 빠를 수 없습니다." };

  const { error } = await supabase.from("monthly_plans").insert({
    title,
    start_date: startDate,
    end_date: endDate,
    color,
    created_by: user.id,
  });

  if (error) return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };

  revalidatePath("/");
  return { success: true };
}

export async function deleteMonthlyPlan(id: string) {
  const supabase = await createClient();
  await supabase.from("monthly_plans").delete().eq("id", id);
  revalidatePath("/");
}

export async function createTodo(content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !content.trim()) return;

  await supabase
    .from("monthly_plan_todos")
    .insert({ content: content.trim(), created_by: user.id });
  revalidatePath("/");
}

export async function toggleTodo(id: string, done: boolean) {
  const supabase = await createClient();
  await supabase.from("monthly_plan_todos").update({ done }).eq("id", id);
  revalidatePath("/");
}

export async function deleteTodo(id: string) {
  const supabase = await createClient();
  await supabase.from("monthly_plan_todos").delete().eq("id", id);
  revalidatePath("/");
}
