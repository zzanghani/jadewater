import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import PaymentForm from "@/components/PaymentForm";
import PaymentRequestList from "@/components/PaymentRequestList";
import PushSubscribeButton from "@/components/PushSubscribeButton";
import { getFrequentAccounts } from "@/lib/frequentAccounts";
import { DEPARTMENT_LABELS } from "@/lib/types";
import type { Department, Store } from "@/lib/types";

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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user.id ?? "";
  const { data: profile } = await supabase
    .from("profiles")
    .select("department")
    .eq("id", userId)
    .maybeSingle();
  const department = profile?.department ?? null;
  const isTeamAccount = !!department;
  const isMaster = stores.length > 1 && !isTeamAccount;

  // 마스터 계정은 각 매장이 올린 현장지출/입금요청을 직접 등록할 일이 없으므로
  // 요청확인 화면만 보여준다. (본사 팀 계정은 stores.length > 1이어도
  // 직접 입금요청을 등록해야 하므로 마스터로 취급하지 않는다.)
  if (isMaster) {
    return (
      <div className="flex flex-col gap-6">
        <ConfirmTab
          storeId={storeId}
          stores={stores}
          isMaster={isMaster}
          isTeamAccount={isTeamAccount}
          userId={userId}
          showDone={showDone}
        />
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
        <RequestTab storeId={storeId} stores={stores} department={department} />
      )}
      {tab === "confirm" && (
        <ConfirmTab
          storeId={storeId}
          stores={stores}
          isMaster={isMaster}
          isTeamAccount={isTeamAccount}
          userId={userId}
          showDone={showDone}
        />
      )}
    </div>
  );
}

async function RequestTab({
  storeId,
  stores,
  department,
}: {
  storeId: string;
  stores: Store[];
  department: Department | null;
}) {
  const isTeamAccount = !!department;
  // 자주쓰는 계좌/월말입금표는 특정 매장의 거래처 입금 이력을 활용하는
  // 기능이라, 매장 소속이 아닌 본사 팀 계정에는 의미가 없어 숨긴다.
  const accounts = isTeamAccount
    ? []
    : await getFrequentAccounts(await createClient(), storeId);

  return (
    <section>
      <h1 className="mb-3 text-lg font-bold">입금요청</h1>
      <PaymentForm
        storeId={storeId}
        stores={stores}
        department={department}
        accounts={accounts}
      />
    </section>
  );
}

async function ConfirmTab({
  storeId,
  stores,
  isMaster,
  isTeamAccount,
  userId,
  showDone,
}: {
  storeId: string;
  stores: Store[];
  isMaster: boolean;
  isTeamAccount: boolean;
  userId: string;
  showDone: boolean;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("payment_requests")
    .select("*")
    .order(showDone ? "completed_at" : "created_at", { ascending: false });

  query = showDone ? query.not("completed_at", "is", null) : query.is("completed_at", null);

  // 본사 팀 계정은 매장 소속이 아니므로 "내가 올린 요청"만, 지점 계정은
  // 자기 매장 요청만, 마스터는 전체를 본다.
  if (isTeamAccount) {
    query = query.eq("created_by", userId);
  } else if (!isMaster) {
    query = query.eq("store_id", storeId);
  }

  const { data: history } = await query.limit(50);

  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  const rows = (history ?? []).map((r) => ({
    ...r,
    storeName: r.store_id ? storeNameById.get(r.store_id) : undefined,
    isTeamRequest: !!r.department,
    teamDepartmentLabel: r.department ? DEPARTMENT_LABELS[r.department] : undefined,
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
