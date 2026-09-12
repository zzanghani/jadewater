import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import LoanRepaymentTable from "@/components/LoanRepaymentTable";

// 금전대차 상환표 — 본사 마스터 계정만. 데이터 자체는 RLS(user_is_hq_master)가
// 막지만, 지점장이 주소로 들어와 빈 화면을 보는 일이 없게 여기서도 돌려보낸다.
export default async function LoansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { stores }] = await Promise.all([
    supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle(),
    getStoreContext(supabase),
  ]);
  const isHqMaster =
    !!profile && profile.role === "owner" && profile.store_id === null && profile.department === null;
  if (!isHqMaster) redirect("/");

  const [{ data: rows }, { data: events }] = await Promise.all([
    supabase.from("loan_repayments").select("*").order("sort_order").order("created_at"),
    supabase
      .from("loan_repayment_events")
      .select("*")
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">금전대차 상환표</h1>
        <p className="mt-1 text-xs text-muted">매장별 투자자 원금과 상환액 · 대표님만 볼 수 있어요</p>
      </div>
      <LoanRepaymentTable
        rows={rows ?? []}
        events={events ?? []}
        storeNames={stores.map((s) => s.name)}
      />
    </div>
  );
}
