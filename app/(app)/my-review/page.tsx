import Link from "next/link";
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
  const [{ data: employee }, { data: myProfile }] = await Promise.all([
    user
      ? supabase
          .from("employees")
          .select("*")
          .eq("user_id", user.id)
          .is("resigned_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("profiles").select("role, department").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!employee) {
    // 매장 계정(지점장)과 본사 계정은 자기가 직접 연결할 수 있다.
    // 직원 계정은 점장에게 요청해야 하므로 안내 문구를 나눈다.
    const canLinkSelf = myProfile?.role === "owner" || !!myProfile?.department;
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-bold">내 평가</h1>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm leading-relaxed text-muted">
            이 계정이 직원 명부의 누구인지 아직 연결되지 않았습니다. 연결해야 어떤 평가표를
            쓸지 정해지고, 자기평가와 받은 기록을 볼 수 있습니다.
          </p>
          {canLinkSelf ? (
            <>
              <p className="text-sm leading-relaxed text-muted">
                <b className="text-foreground">HR → 인사평가 → 계정 연결</b>에서 이 계정을
                명부의 본인(점장)에게 연결해 주세요. 매장 계정을 쓰고 계신 경우
                <b className="text-foreground"> 매장 계정 = 그 매장 점장</b>으로 연결하면 됩니다.
              </p>
              <Link
                href="/hr"
                className="self-start rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
              >
                HR로 이동
              </Link>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              점장님께 <b className="text-foreground">HR → 인사평가 → 계정 연결</b>에서
              연결해 달라고 요청해 주세요.
            </p>
          )}
        </div>
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
