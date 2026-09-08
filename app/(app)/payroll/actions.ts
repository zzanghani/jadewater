"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { monthRangeFromMonthString, shiftMonthString } from "@/lib/date";
import { sendEmail } from "@/lib/email";
import { formatWon } from "@/lib/format";
import type { PayrollEntry, PayrollPosition } from "@/lib/types";

export type PayrollFormState = { error?: string; success?: boolean } | undefined;

const POSITIONS: PayrollPosition[] = ["점장", "부점장", "팀장", "사원", "파트타이머", "프리랜서"];
const PAYROLL_REPORT_TO = "do@leadhr.kr";
const FREELANCER_WITHHOLDING_RATE = 0.033;

function readAmount(formData: FormData, key: string): number {
  const raw = String(formData.get(key) ?? "").replace(/[^\d]/g, "");
  return raw ? Number(raw) : 0;
}

function readDecimal(formData: FormData, key: string): number {
  const raw = String(formData.get(key) ?? "").replace(/[^\d.]/g, "");
  const n = Number(raw);
  return raw && Number.isFinite(n) ? n : 0;
}

function readMonth(formData: FormData): string | null {
  const month = String(formData.get("month") ?? "");
  return /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : null;
}

function readEntry(formData: FormData) {
  const employeeName = String(formData.get("employee_name") ?? "").trim();
  const positionRaw = String(formData.get("position") ?? "");
  const position = POSITIONS.includes(positionRaw as PayrollPosition)
    ? (positionRaw as PayrollPosition)
    : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const isPartTimer = position === "파트타이머";
  const hourlyRate = isPartTimer ? readAmount(formData, "hourly_rate") : 0;
  const workHours = isPartTimer ? readDecimal(formData, "work_hours") : 0;
  const basePay = isPartTimer
    ? Math.round(hourlyRate * workHours)
    : readAmount(formData, "base_pay");

  return {
    employee_name: employeeName,
    position,
    base_pay: basePay,
    bonus: readAmount(formData, "bonus"),
    extra_pay: readAmount(formData, "extra_pay"),
    hourly_rate: isPartTimer ? hourlyRate : null,
    work_hours: isPartTimer ? workHours : null,
    notes,
  };
}

export async function savePayrollEntry(
  _prevState: PayrollFormState,
  formData: FormData
): Promise<PayrollFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const storeId = String(formData.get("store_id") ?? "");
  const month = readMonth(formData);
  const entry = readEntry(formData);

  if (!storeId) return { error: "매장을 선택해 주세요." };
  if (!month) return { error: "월이 올바르지 않습니다." };
  if (!entry.employee_name) return { error: "이름을 입력해 주세요." };

  const { error } = await supabase.from("payroll_entries").insert({
    store_id: storeId,
    month,
    ...entry,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/payroll");
  return { success: true };
}

export async function updatePayrollEntry(
  _prevState: PayrollFormState,
  formData: FormData
): Promise<PayrollFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const id = String(formData.get("id") ?? "");
  const entry = readEntry(formData);
  if (!id) return { error: "수정할 항목을 찾을 수 없습니다." };
  if (!entry.employee_name) return { error: "이름을 입력해 주세요." };

  const { error } = await supabase
    .from("payroll_entries")
    .update({ ...entry, updated_by: user.id })
    .eq("id", id);

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/payroll");
  return { success: true };
}

export async function deletePayrollEntry(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("payroll_entries").delete().eq("id", id);
  revalidatePath("/payroll");
}

// 지난달 명단(이름·직급·계약총급여·시급)을 이번 달로 복사한다. 상여·수당·근무시간은
// 달마다 달라서 비워두고, 이미 이번 달에 내역이 있으면 아무것도 안 한다.
export async function copyPreviousMonthPayroll(
  storeId: string,
  month: string
): Promise<{ error?: string; copied?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "월이 올바르지 않습니다." };

  const thisMonth = `${month}-01`;
  const prevMonth = `${shiftMonthString(month, -1)}-01`;

  const [{ count: existing }, { data: prevRows }] = await Promise.all([
    supabase
      .from("payroll_entries")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("month", thisMonth),
    supabase
      .from("payroll_entries")
      .select("employee_name, position, base_pay, hourly_rate")
      .eq("store_id", storeId)
      .eq("month", prevMonth)
      .order("created_at"),
  ]);

  if ((existing ?? 0) > 0) return { error: "이번 달에 이미 내역이 있어요." };
  if (!prevRows?.length) return { error: "지난달 내역이 없어요." };

  const { error } = await supabase.from("payroll_entries").insert(
    prevRows.map((r) => {
      const isPartTimer = r.position === "파트타이머";
      return {
        store_id: storeId,
        month: thisMonth,
        employee_name: r.employee_name,
        position: r.position,
        base_pay: isPartTimer ? 0 : r.base_pay,
        hourly_rate: isPartTimer ? r.hourly_rate : null,
        created_by: user.id,
        updated_by: user.id,
      };
    })
  );

  if (error) return { error: "복사 중 오류가 발생했습니다." };

  revalidatePath("/payroll");
  return { copied: prevRows.length };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function payDetail(r: PayrollEntry): string {
  if (r.position === "파트타이머" && r.hourly_rate) {
    return `${formatWon(r.hourly_rate)} × ${r.work_hours ?? 0}h`;
  }
  return "";
}

// 프리랜서는 3.3% 원천징수 후 실지급액을 같이 적어준다.
function totalDetail(r: PayrollEntry): string {
  if (r.position !== "프리랜서") return "";
  const total = r.base_pay + r.bonus + r.extra_pay;
  const withheld = Math.round(total * FREELANCER_WITHHOLDING_RATE);
  return `3.3% 공제 ${formatWon(withheld)} · 실지급 ${formatWon(total - withheld)}`;
}

// 이번 달 급여 내역 전체를 본사(대표)에게 메일로 보낸다.
export async function sendPayrollReport(
  storeId: string,
  month: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "월이 올바르지 않습니다." };

  const [{ data: rows }, { data: store }, { data: sender }] = await Promise.all([
    supabase
      .from("payroll_entries")
      .select("*")
      .eq("store_id", storeId)
      .eq("month", `${month}-01`)
      .order("created_at"),
    supabase.from("stores").select("name").eq("id", storeId).maybeSingle(),
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
  ]);

  if (!rows?.length) return { error: "보낼 내역이 없어요. 먼저 직원을 추가해 주세요." };

  const { label } = monthRangeFromMonthString(month);
  const storeName = store?.name ?? "매장";
  const totals = rows.reduce(
    (acc, r) => ({
      base: acc.base + r.base_pay,
      bonus: acc.bonus + r.bonus,
      extra: acc.extra + r.extra_pay,
    }),
    { base: 0, bonus: 0, extra: 0 }
  );
  const grand = totals.base + totals.bonus + totals.extra;

  const td = 'style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px"';
  const tdRight = 'style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;white-space:nowrap"';
  const th = 'style="padding:8px 10px;background:#f3f4f6;font-size:12px;text-align:left;white-space:nowrap"';
  const thRight = 'style="padding:8px 10px;background:#f3f4f6;font-size:12px;text-align:right;white-space:nowrap"';

  const bodyRows = rows
    .map(
      (r) => `<tr>
  <td ${td}>${escapeHtml(r.employee_name)}</td>
  <td ${td}>${escapeHtml(r.position === "프리랜서" ? "프리랜서 (3.3%)" : (r.position ?? ""))}</td>
  <td ${tdRight}>${formatWon(r.base_pay)}${payDetail(r) ? `<br><span style="color:#6b7280;font-size:11px">${escapeHtml(payDetail(r))}</span>` : ""}</td>
  <td ${tdRight}>${formatWon(r.bonus)}</td>
  <td ${tdRight}>${formatWon(r.extra_pay)}</td>
  <td ${tdRight}><strong>${formatWon(r.base_pay + r.bonus + r.extra_pay)}</strong>${totalDetail(r) ? `<br><span style="color:#6b7280;font-size:11px">${escapeHtml(totalDetail(r))}</span>` : ""}</td>
  <td ${td}>${escapeHtml(r.notes ?? "")}</td>
</tr>`
    )
    .join("");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#111827">
  <h2 style="margin:0 0 4px;font-size:18px">${escapeHtml(storeName)} · ${escapeHtml(label)} 급여신고</h2>
  <p style="margin:0 0 16px;font-size:13px;color:#6b7280">작성: ${escapeHtml(sender?.name ?? "")} · 인원 ${rows.length}명</p>
  <table style="border-collapse:collapse;width:100%;max-width:760px">
    <thead><tr>
      <th ${th}>이름</th><th ${th}>직급</th><th ${thRight}>계약총급여</th><th ${thRight}>상여금</th><th ${thRight}>추가수당</th><th ${thRight}>합계</th><th ${th}>비고</th>
    </tr></thead>
    <tbody>${bodyRows}</tbody>
    <tfoot><tr>
      <td ${td} colspan="2"><strong>합계</strong></td>
      <td ${tdRight}><strong>${formatWon(totals.base)}</strong></td>
      <td ${tdRight}><strong>${formatWon(totals.bonus)}</strong></td>
      <td ${tdRight}><strong>${formatWon(totals.extra)}</strong></td>
      <td ${tdRight}><strong>${formatWon(grand)}</strong></td>
      <td ${td}></td>
    </tr></tfoot>
  </table>
  <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">베스트메이트컴퍼니 앱에서 자동 발송된 메일입니다.</p>
</div>`;

  const { error } = await sendEmail({
    to: PAYROLL_REPORT_TO,
    subject: `[급여신고] ${storeName} ${label} (${rows.length}명, ${formatWon(grand)})`,
    html,
  });
  if (error) return { error };
  return { success: true };
}
