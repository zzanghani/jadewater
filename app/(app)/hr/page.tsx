import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { storeColor } from "@/lib/storeColors";
import HrClient from "@/components/HrClient";
import type { Employee } from "@/lib/types";

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
    />
  );
}
