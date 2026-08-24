import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { kstDateString } from "@/lib/date";
import EvalPageClient from "@/components/EvalPageClient";
import type { Employee, PerformanceReview } from "@/lib/types";

export default async function EvalPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const supabase = await createClient();

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .is("resigned_at", null)
    .single();

  if (!employee || employee.employment_type !== "정직원" || !employee.team) {
    notFound();
  }

  const period = kstDateString(0).slice(0, 7);

  const { data: history } = await supabase
    .from("performance_reviews")
    .select("*")
    .eq("employee_id", employeeId)
    .order("period", { ascending: false });

  const currentReview =
    (history ?? []).find((r) => r.period === period) ?? null;

  return (
    <EvalPageClient
      employee={employee as Employee}
      period={period}
      currentReview={currentReview as PerformanceReview | null}
      history={(history ?? []) as PerformanceReview[]}
    />
  );
}
