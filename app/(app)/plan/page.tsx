import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHqPlanData } from "@/lib/monthlyPlans";
import MonthlyPlanAlerts from "@/components/MonthlyPlanAlerts";
import MonthlyPlanCalendar from "@/components/MonthlyPlanCalendar";

// 월간계획 전체 화면 — 홈에 있던 달력·오늘 알림판·일정 목록이 통째로 여기로 왔다.
// 홈에는 "이번 주 일정" 띠만 남고, 띠나 빠른 메뉴 '월간계획'을 누르면 이 화면.
export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle();
  const isHq = !!profile && !profile.store_id && (!!profile.department || profile.role === "owner");
  if (!isHq) redirect("/");

  const { monthlyPlans, commentsByPlan, followersByPlan, hqProfiles } = await loadHqPlanData(supabase);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">월간계획</h1>
        <Link href="/" className="text-sm text-muted">
          ← 홈
        </Link>
      </div>
      <MonthlyPlanAlerts plans={monthlyPlans} />
      <MonthlyPlanCalendar
        plans={monthlyPlans}
        commentsByPlan={commentsByPlan}
        followersByPlan={followersByPlan}
        hqProfiles={hqProfiles}
        currentUserId={user.id}
      />
    </div>
  );
}
