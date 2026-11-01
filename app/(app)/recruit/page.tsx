export const maxDuration = 60;

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import RecruitClient from "@/components/RecruitClient";

// 체험단 검증 — 리뷰노트 2주 모집 지원자의 블로그를 자동으로 확인해 순위를 매긴다.
// 지점장(자기 매장)·본사 마스터(매장 선택).
export default async function RecruitPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { storeId: contextStoreId, stores }] = await Promise.all([
    supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle(),
    getStoreContext(supabase),
  ]);
  const isManager = !!profile && profile.role === "owner" && !profile.department;
  if (!isManager) redirect("/");

  const visible = profile!.store_id ? stores.filter((s) => s.id === profile!.store_id) : stores;
  const storeOptions = visible.map((s) => ({ id: s.id, name: s.name, keywords: s.blog_keywords ?? [] }));
  const defaultStoreId = profile!.store_id ?? contextStoreId;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">체험단 검증</h1>
        <p className="mt-1 text-xs text-muted">리뷰노트 지원자 블로그를 자동으로 확인해 점수 순으로 보여드려요 · 맛집 비중 · 검색 노출 · 협찬 과다</p>
      </div>
      <RecruitClient stores={storeOptions} defaultStoreId={defaultStoreId} />
    </div>
  );
}
