import { findOrCreateFolder, uploadFileToDrive, uploadTextAsPdf } from "@/lib/googleDrive";
import { formatWon } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";

function dateTimeLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(
    2,
    "0"
  )}`;
}

// 현장지출을 저장할 때마다 호출된다. 입금요청 보관과 달리 Supabase 원본은
// 지우지 않고, 구글드라이브에 내역 PDF + 영수증 사진 사본만 자동으로 남긴다.
export async function archiveFieldExpenseToDrive(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseId: string
): Promise<void> {
  const { data: expense, error } = await supabase
    .from("field_expenses")
    .select("*")
    .eq("id", expenseId)
    .single();
  if (error || !expense) throw new Error("현장지출 내역을 찾을 수 없습니다.");

  const [{ data: store }, { data: creator }] = await Promise.all([
    supabase.from("stores").select("name").eq("id", expense.store_id).single(),
    supabase.from("profiles").select("name").eq("id", expense.created_by).single(),
  ]);
  const storeName = store?.name ?? "알 수 없는 매장";

  // 매장 폴더 안에 "현장지출" 하위 폴더를 두고 계속 재사용한다.
  const rootParentId = process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID || "root";
  const storeFolderId = await findOrCreateFolder(storeName, rootParentId);
  const expenseFolderId = await findOrCreateFolder("현장지출", storeFolderId);

  const filePrefix = `[${expense.date}] ${expense.description} - ${formatWon(expense.amount)}`;

  const lines = [
    `현장지출 · ${storeName}`,
    `일자: ${expense.date}`,
    `대분류: ${expense.category}`,
    `구매내역: ${expense.description}`,
    `금액: ${formatWon(expense.amount)}`,
    `결제수단: ${expense.payment_method}`,
    `등록자: ${creator?.name ?? "알 수 없음"}`,
    `등록시각: ${dateTimeLabel(expense.created_at)}`,
  ];

  await uploadTextAsPdf({
    name: `${filePrefix} - 내역`,
    text: lines.join("\n"),
    parentId: expenseFolderId,
  });

  if (expense.receipt_photo_path) {
    const { data: fileBlob } = await supabase.storage
      .from("receipts")
      .download(expense.receipt_photo_path);
    if (fileBlob) {
      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      const ext = expense.receipt_photo_path.split(".").pop() || "jpg";
      await uploadFileToDrive({
        name: `${filePrefix} - 영수증.${ext}`,
        mimeType: fileBlob.type || "image/jpeg",
        buffer,
        parentId: expenseFolderId,
      });
    }
  }
}
