import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import AdAccountForm from "@/components/AdAccountForm";

// 매장별 네이버 검색광고 키·예산 설정 — 본사 마스터만.
export default async function AdReportSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle();
  const isHqMaster = !!profile && profile.role === "owner" && !profile.store_id && !profile.department;
  if (!isHqMaster) redirect("/ad-report");

  const [{ stores }, { data: accounts }] = await Promise.all([
    getStoreContext(supabase),
    supabase.from("store_ad_accounts").select("*"),
  ]);
  const byStore = new Map((accounts ?? []).map((a) => [a.store_id, a]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/ad-report" className="text-xs text-muted">
          ‹ 광고 리포트
        </Link>
        <h1 className="mt-1 text-lg font-bold">매장 광고 키 설정</h1>
        <p className="mt-1 text-xs text-muted">
          네이버 검색광고 → 도구 → API 사용 관리에서 받은 고객 ID·엑세스라이선스·비밀키를 매장별로 넣어요. 저장할 때 실제로 연결해 봐요.
        </p>
      </div>
      {stores.map((s) => (
        <AdAccountForm key={s.id} storeId={s.id} storeName={s.name} account={byStore.get(s.id) ?? null} />
      ))}
    </div>
  );
}
