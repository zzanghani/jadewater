export const maxDuration = 60;

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MenuSalesClient from "@/components/MenuSalesClient";
import AnalysisTabs from "@/components/AnalysisTabs";

// 메뉴 판매 비교·업셀링 — 토스 주문의 메뉴별 판매로 매장을 나란히 본다.
export default async function MenuSalesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle();
  const isManager = !!profile && profile.role === "owner" && !profile.department;
  if (!isManager) redirect("/");
  return (
    <div className="flex flex-col gap-4">
      <AnalysisTabs />
      <p className="-mt-2 text-xs text-muted">메뉴 판매 · 업셀링 — 최근 28일 · 토스 주문 메뉴 기준 · 토스 연결 매장만</p>
      <MenuSalesClient isMaster={!profile?.store_id} />
    </div>
  );
}
