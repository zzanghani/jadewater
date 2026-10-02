import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import StoreLocationForm from "@/components/StoreLocationForm";

// 매장 좌표·반경 설정 — 본사 마스터(매장 선택 가능)와 그 매장 지점장만.
export default async function AttendanceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store: storeParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { stores, storeId: contextStoreId }] = await Promise.all([
    supabase.from("profiles").select("store_id, role, department").eq("id", user.id).single(),
    getStoreContext(supabase),
  ]);

  const isMaster = !profile?.department && !profile?.store_id;
  const isStoreManager = !profile?.department && profile?.role === "owner" && !!profile.store_id;
  if (!isMaster && !isStoreManager) redirect("/attendance");

  // 지점장은 자기 매장만, 마스터는 선택한 매장.
  const storeId = isStoreManager
    ? profile!.store_id!
    : stores.some((s) => s.id === storeParam)
      ? storeParam!
      : contextStoreId;
  const store = stores.find((s) => s.id === storeId);
  if (!store) redirect("/attendance");

  const { data: location } = await supabase
    .from("store_locations")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/attendance" className="text-xs text-muted">
          ‹ 출퇴근
        </Link>
        <h1 className="mt-1 text-lg font-bold">매장 위치 설정</h1>
        <p className="mt-1 text-xs text-muted">
          이 좌표를 기준으로 반경 안에서만 출퇴근이 기록돼요. 매장 입구에서 한 번 잡아두면 됩니다.
        </p>
      </div>

      {isMaster && stores.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/attendance/settings?store=${s.id}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                s.id === storeId ? "border-brand bg-brand text-white" : "border-border bg-card text-foreground"
              }`}
            >
              {s.short_label ?? s.name}
            </Link>
          ))}
        </div>
      )}

      <StoreLocationForm key={storeId} storeId={storeId} storeName={store.name} location={location ?? null} />
    </div>
  );
}
