import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import FieldExpenseForm from "@/components/FieldExpenseForm";
import FieldExpenseList from "@/components/FieldExpenseList";

export default async function ExpensePage() {
  const supabase = await createClient();
  const { storeId } = await getStoreContext(supabase);

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
    <div className="flex flex-col gap-6">
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
    </div>
  );
}
