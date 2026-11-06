import AdPageHeader from "@/components/AdPageHeader";
import AdStoreSelect from "@/components/AdStoreSelect";
import AdDailyBoard, { type BoardPostRow } from "@/components/AdDailyBoard";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveAdPageScope } from "@/lib/adPage";
import type { AdDailyPost } from "@/lib/adDailyPost";

// 성과 확인 게시판 — 매일 아침 자동으로 올라오는 "어제 광고 성과" 글.
// 머리글에서 매장을 고른다(마스터 전부·지점장은 같은 브랜드). 확인 버튼은 자기 매장(또는 본사)만.
export default async function AdDailyBoardPage() {
  const { storeId, stores, canEdit, isHqMaster } = await resolveAdPageScope();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const service = createServiceClient();
  const storeName = stores.find((s) => s.id === storeId)?.name ?? "";

  const { data: posts } = await service.from("ad_daily_posts").select("date, post, generated_at").eq("store_id", storeId).order("date", { ascending: false }).limit(30);
  const dates = (posts ?? []).map((p) => p.date);
  const { data: reads } = dates.length
    ? await service.from("ad_daily_post_reads").select("date, user_id, read_at").eq("store_id", storeId).in("date", dates)
    : { data: [] as { date: string; user_id: string; read_at: string }[] };
  const readerIds = Array.from(new Set((reads ?? []).map((r) => r.user_id)));
  const { data: readers } = readerIds.length ? await service.from("profiles").select("id, name").in("id", readerIds) : { data: [] as { id: string; name: string | null }[] };
  const nameById = new Map((readers ?? []).map((r) => [r.id, r.name ?? "이름 없음"]));

  const rows: BoardPostRow[] = (posts ?? []).map((p) => ({
    date: p.date,
    generatedAt: p.generated_at,
    post: p.post as unknown as AdDailyPost,
    reads: (reads ?? []).filter((r) => r.date === p.date).map((r) => ({ userId: r.user_id, name: nameById.get(r.user_id) ?? "이름 없음", readAt: r.read_at })),
  }));

  return (
    <div className="flex flex-col gap-4">
      <AdPageHeader back="/ad-report" backLabel="광고 리포트" title="성과 확인" desc={`${storeName} · 매일 아침 8시 어제 성과 자동 게시`} action={<AdStoreSelect stores={stores} current={storeId} />} />
      <AdDailyBoard key={storeId} storeId={storeId} rows={rows} currentUserId={user?.id ?? ""} canConfirm={canEdit && !isHqMaster} showReads={isHqMaster} />
    </div>
  );
}
