import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { storeColor } from "@/lib/storeColors";
import HrClient from "@/components/HrClient";
import type { Employee } from "@/lib/types";

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
    />
  );
}
