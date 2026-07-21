import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { buildKakaoMessage } from "@/lib/kakao";
import { getStoreContext } from "@/lib/store";
import PaymentForm from "@/components/PaymentForm";
import FieldExpenseForm from "@/components/FieldExpenseForm";
import CopyButton from "@/components/CopyButton";

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
  const { storeId } = await getStoreContext(supabase);

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
      {tab === "request" && <RequestTab storeId={storeId} />}
      {tab === "confirm" && <ConfirmTab storeId={storeId} />}
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
        {rows.length === 0 ? (
          <p className="text-sm text-muted">아직 등록된 지출이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => {
              const photoUrl = r.receipt_photo_path
                ? signedUrlByPath.get(r.receipt_photo_path)
                : undefined;
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt="영수증"
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-background text-lg">
                      🧾
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {r.description}
                    </p>
                    <p className="text-xs text-muted">
                      {r.date} · {r.category} · {r.payment_method}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold">
                    {formatWon(r.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

async function RequestTab({ storeId }: { storeId: string }) {
  return (
    <section>
      <h1 className="mb-3 text-lg font-bold">입금요청</h1>
      <PaymentForm storeId={storeId} />
    </section>
  );
}

async function ConfirmTab({ storeId }: { storeId: string }) {
  const supabase = await createClient();

  const { data: history } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <section>
      <h1 className="mb-3 text-lg font-bold">요청확인</h1>
      {!history?.length ? (
        <p className="text-sm text-muted">아직 등록된 요청이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((r) => {
            const requestDate = new Date(r.created_at).toLocaleDateString(
              "ko-KR",
              { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }
            );
            const message = buildKakaoMessage({
              vendorName: r.vendor_name,
              amount: r.amount,
              bankName: r.bank_name ?? undefined,
              accountNumber: r.account_number ?? undefined,
              date: requestDate,
            });
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {r.vendor_name}
                  </p>
                  <p className="text-xs text-muted">
                    {formatWon(r.amount)} · {requestDate}
                  </p>
                </div>
                <CopyButton text={message} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
