import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { storeColor } from "@/lib/storeColors";
import HrClient from "@/components/HrClient";
import type { Employee } from "@/lib/types";

export default async function HrPage() {
  const supabase = await createClient();
  const { stores } = await getStoreContext(supabase);
  const storeIds = stores.map((s) => s.id);

  const { data: employees } = storeIds.length
    ? await supabase
        .from("employees")
        .select("*")
        .in("store_id", storeIds)
        .order("hire_date", { ascending: true })
    : { data: [] as Employee[] };

  const employeesByStore: Record<string, Employee[]> = {};
  for (const emp of employees ?? []) {
    const list = employeesByStore[emp.store_id] ?? [];
    list.push(emp);
    employeesByStore[emp.store_id] = list;
  }

  const clientStores = stores.map((s) => ({
    id: s.id,
    name: s.name,
    color: storeColor(s.name),
  }));

  return <HrClient stores={clientStores} employeesByStore={employeesByStore} />;
}
