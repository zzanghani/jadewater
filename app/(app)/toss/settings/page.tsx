import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import TossSettingsForm from "@/components/TossSettingsForm";

// 토스플레이스 연결 설정 — 본사 마스터만. 앱 키 한 벌 + 매장별 가맹점 ID.
export default async function TossSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle();
  const isHqMaster = !!profile && profile.role === "owner" && !profile.store_id && !profile.department;
  if (!isHqMaster) redirect("/");

  const [{ stores }, { data: keys }, { data: merchants }] = await Promise.all([
    getStoreContext(supabase),
    supabase.from("toss_settings").select("access_key, updated_at").eq("id", 1).maybeSingle(),
    supabase.from("store_toss_merchants").select("*"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/ad-report/settings" className="text-xs text-muted">
          ‹ 광고 키 설정
        </Link>
        <h1 className="mt-1 text-lg font-bold">토스포스 연결</h1>
        <p className="mt-1 text-xs text-muted">
          토스플레이스 개발자센터의 앱 인증 키(Access Key·Secret)를 한 번 넣고, 매장마다 가맹점 ID(MerchantId)를 연결해요.
        </p>
      </div>
      <TossSettingsForm
        stores={stores.map((s) => ({ id: s.id, name: s.name }))}
        hasKeys={!!keys}
        accessKeyMasked={keys ? keys.access_key.slice(0, 4) + "••••" + keys.access_key.slice(-4) : null}
        merchants={merchants ?? []}
      />
    </div>
  );
}
