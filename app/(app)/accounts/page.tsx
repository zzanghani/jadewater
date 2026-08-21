import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PendingAccountsList from "@/components/PendingAccountsList";

export default async function AccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id, department")
    .eq("id", user.id)
    .single();
  const isMaster = !!profile && !profile.store_id && !profile.department;
  if (!isMaster) redirect("/");

  const { data: pending } = await supabase
    .from("profiles")
    .select("id, name, email, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">가입 승인</h1>
      <p className="text-sm text-muted">
        직원이 가입하면 여기서 승인해야 로그인 후 이용할 수 있어요. 승인 후 첫
        로그인 때 본인이 소속 매장을 직접 선택합니다.
      </p>
      <PendingAccountsList accounts={pending ?? []} />
    </div>
  );
}
