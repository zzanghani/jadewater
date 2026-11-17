import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StabilityPanel from "@/components/StabilityPanel";

// 앱 점검(안정화) 결과 — 본사 마스터(대표) 전용.
// 매일 06시 아침 점검 루틴이 올린 결과를 보고, 확인 표시와 피드백을 남긴다.
// 피드백은 다음 아침 루틴이 읽어 반영하고 답을 남긴다.
export default async function StabilityPage() {
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

  const [{ data: reports }, { data: feedback }] = await Promise.all([
    supabase
      .from("stability_reports")
      .select("date, verdict, summary, fixed, todo, detail, checked_at, updated_at")
      .order("date", { ascending: false })
      .limit(30),
    supabase
      .from("stability_feedback")
      .select("id, report_date, body, created_at, status, reply, replied_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">앱 점검</h1>
        <p className="mt-1 text-sm text-muted">
          매일 아침 6시에 앱의 기능이 실제로 돌고 있는지(리뷰 수집·광고·토스·출퇴근 알림 등), 화면이 깨진 곳은 없는지
          자동으로 점검한 결과예요. 읽으셨으면 확인 표시를 남기고, 고칠 점이나 궁금한 점은 아래에 적어 주세요. 다음 날
          아침 점검 때 반영하고 답을 남깁니다.
        </p>
      </div>
      <StabilityPanel reports={reports ?? []} feedback={feedback ?? []} />
    </div>
  );
}
