import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentEvalPeriod } from "@/lib/evalRubric";
import EvalPageClient from "@/components/EvalPageClient";
import type { Employee, PeerFeedback, PerformanceReview } from "@/lib/types";

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

  const period = currentEvalPeriod();

  const { data: history } = await supabase
    .from("performance_reviews")
    .select("*")
    .eq("employee_id", employeeId)
    .order("period", { ascending: false });

  const currentReview =
    (history ?? []).find((r) => r.period === period) ?? null;

  const { data: peerFeedback } = currentReview
    ? await supabase
        .from("peer_feedback")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("period", period)
        .order("created_at", { ascending: false })
    : { data: [] as PeerFeedback[] };

  return (
    <EvalPageClient
      employee={employee as Employee}
      period={period}
      currentReview={currentReview as PerformanceReview | null}
      history={(history ?? []) as PerformanceReview[]}
      peerFeedback={(peerFeedback ?? []) as PeerFeedback[]}
    />
  );
}
