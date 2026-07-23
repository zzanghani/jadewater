import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import PaymentForm from "@/components/PaymentForm";
import PaymentRequestList from "@/components/PaymentRequestList";
import PushSubscribeButton from "@/components/PushSubscribeButton";
import type { Store } from "@/lib/types";

type Tab = "request" | "confirm";

const TABS: { key: Tab; label: string }[] = [
  { key: "request", label: "입금요청" },
  { key: "confirm", label: "요청확인" },
];

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const { tab: tabParam, status: statusParam } = await searchParams;
  const showDone = statusParam === "done";

  const supabase = await createClient();
  const { storeId, stores } = await getStoreContext(supabase);
  const isMaster = stores.length > 1;

  // 마스터 계정은 각 매장이 올린 현장지출/입금요청을 직접 등록할 일이 없으므로
  // 요청확인 화면만 보여준다.
  if (isMaster) {
    return (
      <div className="flex flex-col gap-6">
        <ConfirmTab storeId={storeId} stores={stores} isMaster={isMaster} showDone={showDone} />
      </div>
    );
  }

  const tab: Tab = TABS.some((t) => t.key === tabParam)
    ? (tabParam as Tab)
    : "request";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-card p-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/payment?tab=${t.key}`}
            className={`rounded-xl py-2.5 text-center text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-brand text-white shadow-sm"
                : "text-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "request" && (
        <RequestTab storeId={storeId} stores={stores} />
      )}
      {tab === "confirm" && (
        <ConfirmTab storeId={storeId} stores={stores} isMaster={isMaster} showDone={showDone} />
      )}
    </div>
  );
}

async function RequestTab({
  storeId,
  stores,
}: {
  storeId: string;
  stores: Store[];
}) {
  return (
    <section>
      <h1 className="mb-3 text-lg font-bold">입금요청</h1>
      <PaymentForm storeId={storeId} stores={stores} />
    </section>
  );
}

async function ConfirmTab({
  storeId,
  stores,
  isMaster,
  showDone,
}: {
  storeId: string;
  stores: Store[];
  isMaster: boolean;
  showDone: boolean;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("payment_requests")
    .select("*")
    .order(showDone ? "completed_at" : "created_at", { ascending: false });

  query = showDone ? query.not("completed_at", "is", null) : query.is("completed_at", null);

  if (!isMaster) {
    query = query.eq("store_id", storeId);
  }

  const { data: history } = await query.limit(50);

  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  const rows = (history ?? []).map((r) => ({
    ...r,
    storeName: storeNameById.get(r.store_id),
  }));

  const tabQuery = isMaster ? "" : "&tab=confirm";

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold">요청확인</h1>
        <PushSubscribeButton storeId={isMaster ? null : storeId} />
      </div>
      <div className="mb-3 flex justify-end">
        <Link
          href={showDone ? `/payment?status=open${tabQuery}` : `/payment?status=done${tabQuery}`}
          className="text-xs font-medium text-muted underline-offset-2 hover:underline"
        >
          {showDone ? "진행중인 요청 보기" : "완료된 요청 보기"}
        </Link>
      </div>
      <PaymentRequestList requests={rows} isMaster={isMaster} showDone={showDone} />
    </section>
  );
}
