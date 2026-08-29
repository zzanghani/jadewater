import { createClient } from "@/lib/supabase/server";
import { currentQuarterRange } from "@/lib/employeeRecords";
import SelfReview from "@/components/SelfReview";
import type { Employee, EmployeeRecord, PerformanceReview } from "@/lib/types";

export default async function MyReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const quarter = currentQuarterRange();

  // 계정에 연결된 내 명부 row. 연결이 안 돼 있으면 아무것도 못 한다.
  const { data: employee } = user
    ? await supabase
        .from("employees")
        .select("*")
        .eq("user_id", user.id)
        .is("resigned_at", null)
        .maybeSingle()
    : { data: null };

  if (!employee) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-bold">내 평가</h1>
        <p className="rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-muted">
          직원 명부와 계정이 아직 연결되지 않았습니다.
          <br />
          점장님께 <b className="text-foreground">HR → 인사평가 → 계정 연결</b>에서
          연결해 달라고 요청해 주세요.
        </p>
      </div>
    );
  }

  // 확정된 지난 평가까지 함께 보여준다 — 추이가 보여야 의미가 있다.
  const [{ data: reviews }, { data: records }] = await Promise.all([
    supabase
      .from("performance_reviews")
      .select("*")
      .eq("employee_id", employee.id)
      .order("period", { ascending: false }),
    // RLS가 공개된 것만 내려보낸다(칭찬은 즉시, 지적은 면담에서 공개한 뒤).
    supabase
      .from("employee_records")
      .select("*")
      .eq("employee_id", employee.id)
      .gte("occurred_on", quarter.start)
      .lte("occurred_on", quarter.end)
      .order("occurred_on", { ascending: false }),
  ]);

  return (
    <SelfReview
      employee={employee as Employee}
      reviews={(reviews ?? []) as PerformanceReview[]}
      records={(records ?? []) as EmployeeRecord[]}
      period={quarter.period}
      periodLabel={quarter.label}
    />
  );
}
