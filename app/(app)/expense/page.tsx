import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import FieldExpenseForm from "@/components/FieldExpenseForm";
import FieldExpenseList from "@/components/FieldExpenseList";

export default async function ExpensePage() {
  const supabase = await createClient();
  const { storeId, stores } = await getStoreContext(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("department").eq("id", user.id).single()
    : { data: null };
  const isTeamAccount = !!profile?.department;

  // 팀 계정은 고정 매장이 없어 최근 내역도 전 매장 기준으로 보여준다.
  let query = supabase
    .from("field_expenses")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);
  query = isTeamAccount ? query : query.eq("store_id", storeId);
  const { data: expenses } = await query;

  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
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
    storeName: isTeamAccount ? storeNameById.get(r.store_id) : undefined,
  }));

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="mb-3 text-lg font-bold">현장지출</h1>
        <FieldExpenseForm storeId={storeId} stores={isTeamAccount ? stores : undefined} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          최근 등록 내역
        </h2>
        <FieldExpenseList
          rows={rowsWithPhoto}
          storeId={storeId}
          stores={isTeamAccount ? stores : undefined}
        />
      </section>
    </div>
  );
}
