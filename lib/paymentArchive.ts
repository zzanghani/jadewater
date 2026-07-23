import { findOrCreateFolder, uploadTextAsPdf } from "@/lib/googleDrive";
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

export async function archivePaymentRequestToDrive(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string
): Promise<void> {
  const { data: request, error } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (error || !request) throw new Error("입금요청을 찾을 수 없습니다.");

  const [{ data: store }, { data: requester }] = await Promise.all([
    supabase.from("stores").select("name").eq("id", request.store_id).single(),
    supabase.from("profiles").select("name").eq("id", request.created_by).single(),
  ]);
  const storeName = store?.name ?? "알 수 없는 매장";

  // 매장별 폴더 하나를 계속 재사용한다.
  const rootParentId = process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID || "root";
  const storeFolderId = await findOrCreateFolder(storeName, rootParentId);

  const lines: string[] = [];
  lines.push(`입금요청 · ${storeName}`);
  lines.push(`거래처: ${request.vendor_name}`);
  lines.push(`금액: ${formatWon(request.amount)}`);
  if (request.bank_name) lines.push(`은행: ${request.bank_name}`);
  if (request.account_number) lines.push(`계좌번호: ${request.account_number}`);
  lines.push(`요청자: ${requester?.name ?? "알 수 없음"}`);
  lines.push(`요청일: ${dateTimeLabel(request.created_at)}`);
  lines.push(`완료일: ${request.completed_at ? dateTimeLabel(request.completed_at) : "미완료"}`);

  const dateOnly = dateTimeLabel(request.created_at).slice(0, 10);
  await uploadTextAsPdf({
    name: `[${dateOnly}] ${request.vendor_name} - ${formatWon(request.amount)}`,
    text: lines.join("\n"),
    parentId: storeFolderId,
  });
}
