import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { storeColor } from "@/lib/storeColors";
import { currentEvalPeriod } from "@/lib/evalRubric";
import HrClient from "@/components/HrClient";
import type { Employee, PerformanceReview } from "@/lib/types";

export default async function HrPage() {
  const supabase = await createClient();
  const { stores } = await getStoreContext(supabase);

  const [{ data: employees }, { data: resignedEmployees }] = await Promise.all([
    supabase
      .from("employees")
      .select("*")
      .is("resigned_at", null)
      .order("hire_date", { ascending: true }),
    supabase
      .from("employees")
      .select("*")
      .not("resigned_at", "is", null)
      .order("resigned_at", { ascending: false }),
  ]);

  const msoEmployees: Employee[] = [];
  const employeesByStore: Record<string, Employee[]> = {};
  for (const emp of employees ?? []) {
    if (emp.department) {
      msoEmployees.push(emp);
      continue;
    }
    if (!emp.store_id) continue;
    const list = employeesByStore[emp.store_id] ?? [];
    list.push(emp);
    employeesByStore[emp.store_id] = list;
  }

  // 근무평가는 일단 매장 정직원만 대상(직원 상세 팝업과 별개 화면).
  const evalEligibleIds = Object.values(employeesByStore)
    .flat()
    .filter((e) => e.employment_type === "정직원" && e.team)
    .map((e) => e.id);

  const period = currentEvalPeriod();
  const { data: currentReviews } = evalEligibleIds.length
    ? await supabase
        .from("performance_reviews")
        .select("*")
        .eq("period", period)
        .in("employee_id", evalEligibleIds)
    : { data: [] as PerformanceReview[] };

  const currentPeriodReviews: Record<string, PerformanceReview> = {};
  for (const r of currentReviews ?? []) {
    currentPeriodReviews[r.employee_id] = r;
  }

  const clientStores = stores.map((s) => ({
    id: s.id,
    name: s.name,
    color: storeColor(s.name),
  }));

  return (
    <HrClient
      stores={clientStores}
      msoEmployees={msoEmployees}
      employeesByStore={employeesByStore}
      resignedEmployees={resignedEmployees ?? []}
      currentPeriodReviews={currentPeriodReviews}
    />
  );
}
