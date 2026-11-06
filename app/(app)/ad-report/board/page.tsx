import AdPageHeader from "@/components/AdPageHeader";
import BoardStoreSelect from "@/components/BoardStoreSelect";
import AdDailyBoard, { type AllPostRow, type BoardPostRow } from "@/components/AdDailyBoard";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveAdPageScope } from "@/lib/adPage";
import { combineAdDailyPosts, type AdDailyPost } from "@/lib/adDailyPost";

// 성과 확인 게시판 — 매일 아침 자동으로 올라오는 "어제 광고 성과" 글.
// 점장도 전 매장 글을 다 본다(대표님 지시 2026-11-06): "전체 매장" 탭은 모든 매장 글을 날짜별로 합쳐 보여주고,
// "매장별" 탭은 머리글에서 고른 매장 글(처음엔 자기 매장). 확인 버튼은 자기 매장 점장만.
export default async function AdDailyBoardPage({ searchParams }: { searchParams: Promise<{ view?: string; store?: string }> }) {
  const [scope, { view, store: storeParam }] = await Promise.all([resolveAdPageScope(), searchParams]);
  const { isHqMaster } = scope;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const service = createServiceClient();
  // 전 매장 (브랜드 → 매장 순)
  const [{ data: storeRows }, { data: brandRows }, { data: profile }] = await Promise.all([
    service.from("stores").select("id, name, brand_id, sort_order"),
    service.from("brands").select("id, sort_order"),
    user ? supabase.from("profiles").select("store_id").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const brandOrder = new Map((brandRows ?? []).map((b) => [b.id, b.sort_order]));
  const stores = (storeRows ?? [])
    .slice()
    .sort((a, b) => {
      const ba = brandOrder.get(a.brand_id) ?? Number.MAX_SAFE_INTEGER;
      const bb = brandOrder.get(b.brand_id) ?? Number.MAX_SAFE_INTEGER;
      return ba !== bb ? ba - bb : a.sort_order - b.sort_order;
    })
    .map(({ id, name, brand_id }) => ({ id, name, brand_id }));
  const ownStoreId = profile?.store_id ?? null;
  const storeId =
    storeParam && stores.some((s) => s.id === storeParam) ? storeParam : ownStoreId && stores.some((s) => s.id === ownStoreId) ? ownStoreId : stores.some((s) => s.id === scope.storeId) ? scope.storeId : (stores[0]?.id ?? scope.storeId);
  const canEdit = !!ownStoreId && ownStoreId === storeId;
  const storeName = stores.find((s) => s.id === storeId)?.name ?? "";
  const nameOf = new Map(stores.map((s) => [s.id, s.name]));
  const storeIds = stores.map((s) => s.id);

  // 최근 30일치 — 볼 수 있는 매장 전부 (매장별 탭은 여기서 고른 매장만 추린다)
  const { data: posts } = await service
    .from("ad_daily_posts")
    .select("store_id, date, post, generated_at")
    .in("store_id", storeIds.length ? storeIds : [storeId])
    .order("date", { ascending: false })
    .limit(30 * Math.max(1, storeIds.length));
  const dates = Array.from(new Set((posts ?? []).map((p) => p.date)));
  const { data: reads } = dates.length
    ? await service.from("ad_daily_post_reads").select("store_id, date, user_id, read_at").in("store_id", storeIds).in("date", dates)
    : { data: [] as { store_id: string; date: string; user_id: string; read_at: string }[] };
  const readerIds = Array.from(new Set((reads ?? []).map((r) => r.user_id)));
  const { data: readers } = readerIds.length ? await service.from("profiles").select("id, name").in("id", readerIds) : { data: [] as { id: string; name: string | null }[] };
  const nameById = new Map((readers ?? []).map((r) => [r.id, r.name ?? "이름 없음"]));
  const readsFor = (sid: string, date: string) =>
    (reads ?? []).filter((r) => r.store_id === sid && r.date === date).map((r) => ({ userId: r.user_id, name: nameById.get(r.user_id) ?? "이름 없음", readAt: r.read_at }));

  const rows: BoardPostRow[] = (posts ?? [])
    .filter((p) => p.store_id === storeId)
    .map((p) => ({ date: p.date, generatedAt: p.generated_at, post: p.post as unknown as AdDailyPost, reads: readsFor(p.store_id, p.date) }));

  // 전체 매장: 날짜마다 매장 글을 합친다 (매장이 둘 이상 보일 때만)
  const allRows: AllPostRow[] | null =
    storeIds.length >= 2
      ? dates.slice(0, 30).map((date) => {
          const items = (posts ?? [])
            .filter((p) => p.date === date)
            .map((p) => ({ storeId: p.store_id, name: nameOf.get(p.store_id) ?? "매장", post: p.post as unknown as AdDailyPost }))
            .sort((a, b) => storeIds.indexOf(a.storeId) - storeIds.indexOf(b.storeId));
          return {
            date,
            generatedAt: (posts ?? []).filter((p) => p.date === date).map((p) => p.generated_at).sort()[0],
            all: combineAdDailyPosts(date, items),
            reads: items.map((i) => ({ storeId: i.storeId, name: i.name, confirmed: readsFor(i.storeId, date).length > 0 })),
          };
        })
      : null;

  // 처음 열면: 본사는 전체 매장, 점장은 자기 매장. 주소의 view 값이 있으면 그대로.
  const defaultView: "all" | "store" = view === "all" ? "all" : view === "store" ? "store" : isHqMaster && allRows ? "all" : "store";

  return (
    <div className="flex flex-col gap-4">
      <AdPageHeader back="/ad-report" backLabel="광고 리포트" title="성과 확인" desc={`${storeName} · 매일 아침 8시 어제 성과 자동 게시`} action={<BoardStoreSelect stores={stores} current={storeId} />} />
      <AdDailyBoard key={storeId} storeId={storeId} rows={rows} allRows={allRows} defaultView={defaultView} currentUserId={user?.id ?? ""} canConfirm={canEdit} showReads={isHqMaster} />
    </div>
  );
}
