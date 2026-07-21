import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import PaymentForm from "@/components/PaymentForm";
import FieldExpenseForm from "@/components/FieldExpenseForm";
import FieldExpenseList from "@/components/FieldExpenseList";
import PaymentRequestList from "@/components/PaymentRequestList";
import type { Store } from "@/lib/types";

type Tab = "expense" | "request" | "confirm";

const TABS: { key: Tab; label: string }[] = [
  { key: "expense", label: "현장지출" },
  { key: "request", label: "입금요청" },
  { key: "confirm", label: "요청확인" },
];

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam)
    ? (tabParam as Tab)
    : "expense";

  const supabase = await createClient();
  const { storeId, stores } = await getStoreContext(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-card p-1.5">
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

      {tab === "expense" && <FieldExpenseTab storeId={storeId} />}
      {tab === "request" && (
        <RequestTab storeId={storeId} stores={stores} />
      )}
      {tab === "confirm" && (
        <ConfirmTab storeId={storeId} stores={stores} />
      )}
    </div>
  );
}

async function FieldExpenseTab({ storeId }: { storeId: string }) {
  const supabase = await createClient();

  const { data: expenses } = await supabase
    .from("field_expenses")
    .select("*")
    .eq("store_id", storeId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = expenses ?? [];

  const photoPaths = rows
    .map((r) => r.receipt_photo_path)
    .filter((p): p is string => !!p);

  const signedUrlByPath = new Map<string, string>();
  if (photoPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("receipts")
      .createSignedUrls(photoPaths, 3600);
    for (const s of signedUrls ?? []) {
      if (s.signedUrl) signedUrlByPath.set(s.path ?? "", s.signedUrl);
    }
  }

  const rowsWithPhoto = rows.map((r) => ({
    ...r,
    photoUrl: r.receipt_photo_path
      ? signedUrlByPath.get(r.receipt_photo_path)
      : undefined,
  }));

  return (
    <>
      <section>
        <h1 className="mb-3 text-lg font-bold">현장지출</h1>
        <FieldExpenseForm storeId={storeId} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          최근 등록 내역
        </h2>
        <FieldExpenseList rows={rowsWithPhoto} />
      </section>
    </>
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
}: {
  storeId: string;
  stores: Store[];
}) {
  const supabase = await createClient();
  const isMaster = stores.length > 1;

  let query = supabase
    .from("payment_requests")
    .select("*")
    .is("completed_at", null)
    .order("created_at", { ascending: false });

  if (!isMaster) {
    query = query.eq("store_id", storeId);
  }

  const { data: history } = await query.limit(50);

  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  const rows = (history ?? []).map((r) => ({
    ...r,
    storeName: storeNameById.get(r.store_id),
  }));

  return (
    <section>
      <h1 className="mb-3 text-lg font-bold">요청확인</h1>
      <PaymentRequestList requests={rows} isMaster={isMaster} />
    </section>
  );
}
