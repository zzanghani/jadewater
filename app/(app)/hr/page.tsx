import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { storeColor } from "@/lib/storeColors";
import HrClient from "@/components/HrClient";
import { currentQuarterRange } from "@/lib/employeeRecords";
import type {
  DamageRecord,
  Employee,
  EmployeeAttendance,
  EmployeeRecord,
  PerformanceReview,
} from "@/lib/types";

export default async function HrPage() {
  const supabase = await createClient();
  const { stores } = await getStoreContext(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: employees }, { data: resignedEmployees }, { data: myProfile }] = await Promise.all([
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
    user
      ? supabase.from("profiles").select("department, store_id").eq("id", user.id).single()
      : { data: null },
  ]);

  // MSO운영회사 소속 등록은 rnd/ops/마스터만 — 지점장은 자기 매장 직원만
  // 다루므로 소속 구분 자체를 고를 필요가 없다.
  const canManageMso =
    !myProfile?.store_id &&
    (myProfile?.department === null ||
      myProfile?.department === "rnd" ||
      myProfile?.department === "ops");

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

  // 사건 기록은 이번 분기치만 가져온다 — 근무평가 주기와 같은 단위.
  // RLS가 알아서 걸러주므로(권한자 전부 / 본인은 공개된 것만) 여기선 기간만 건다.
  const quarter = currentQuarterRange();
  const { data: records } = await supabase
    .from("employee_records")
    .select("*")
    .gte("occurred_on", quarter.start)
    .lte("occurred_on", quarter.end)
    .order("occurred_on", { ascending: false });

  // 아직 직원 명부에 연결되지 않은 승인 계정 — 연결돼야 기록을 남길 수 있다.
  const linkedUserIds = new Set(
    (employees ?? []).map((e) => e.user_id).filter((v): v is string => !!v)
  );
  const { data: approvedProfiles } = await supabase
    .from("profiles")
    .select("id, name, email, store_id, department, role")
    .eq("status", "approved");
  const unlinkedAccounts = (approvedProfiles ?? [])
    .filter((p) => !linkedUserIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      storeId: p.store_id,
    }));

  // 이번 분기 근무평가 — 채점 진행 상황과 확정 등급을 목록에 붙인다.
  const { data: reviews } = await supabase
    .from("performance_reviews")
    .select("*")
    .eq("period", quarter.period);

  // 근태(지문인식 월별 입력)와 damage list — 둘 다 이번 분기치만.
  const quarterMonths = [0, 1, 2].map((i) => {
    const startMonth = (Number(quarter.period.split("-Q")[1]) - 1) * 3 + 1 + i;
    return `${quarter.period.slice(0, 4)}-${String(startMonth).padStart(2, "0")}`;
  });
  const [{ data: attendance }, { data: damages }] = await Promise.all([
    supabase.from("employee_attendance").select("*").in("month", quarterMonths),
    supabase
      .from("damage_records")
      .select("*")
      .gte("occurred_on", quarter.start)
      .lte("occurred_on", quarter.end)
      .order("occurred_on", { ascending: false }),
  ]);

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
      canManageMso={!!canManageMso}
      records={(records ?? []) as EmployeeRecord[]}
      quarterLabel={quarter.label}
      period={quarter.period}
      reviews={(reviews ?? []) as PerformanceReview[]}
      attendance={(attendance ?? []) as EmployeeAttendance[]}
      damages={(damages ?? []) as DamageRecord[]}
      unlinkedAccounts={unlinkedAccounts}
      myUserId={user?.id ?? null}
    />
  );
}
