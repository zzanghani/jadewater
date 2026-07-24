import { findOrCreateFolder, uploadTextAsPdf } from "@/lib/googleDrive";
import { weekRangeLabel } from "@/lib/date";
import type { WeeklyReport } from "@/lib/types";

function listLines(label: string, items: string[]): string[] {
  const lines = [label];
  if (items.length === 0) {
    lines.push("(작성된 내용 없음)");
  } else {
    items.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
  }
  lines.push("");
  return lines;
}

// 지난 주간보고를 구글드라이브에 PDF로 백업한다. Supabase의 원본 데이터는
// 지우지 않는다 (게시판/입금요청 보관과 달리 계속 앱에서 조회 가능해야 함).
export async function archiveWeeklyReportToDrive(
  report: WeeklyReport,
  storeName: string
): Promise<void> {
  const rootParentId = process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID || "root";
  const weeklyRootId = await findOrCreateFolder("주간보고", rootParentId);
  const storeFolderId = await findOrCreateFolder(storeName, weeklyRootId);

  const weekLabel = weekRangeLabel(report.week_start);

  const lines: string[] = [];
  lines.push(`${storeName} 주간보고`);
  lines.push(`기간: ${weekLabel}`);
  lines.push("");
  lines.push(...listLines("[주간목표]", report.goals));
  lines.push(...listLines("[HR - 진행상황]", report.hr_items));

  lines.push("[매출]");
  if (report.sales_notes.length === 0) {
    lines.push("(작성된 메모 없음)");
  } else {
    report.sales_notes.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
  }
  if (report.sales_table.length > 0) {
    lines.push("");
    lines.push("항목 / 전주 / 금주");
    for (const row of report.sales_table) {
      lines.push(`${row.label} / ${row.lastWeek} / ${row.thisWeek}`);
    }
  }
  lines.push("");

  lines.push(...listLines("[주간이슈]", report.issues));
  lines.push(...listLines("[키친]", report.kitchen_items));
  lines.push(...listLines("[홀]", report.hall_items));

  await uploadTextAsPdf({
    name: `[${report.week_start}] ${weekLabel} 주간보고`,
    text: lines.join("\n"),
    parentId: storeFolderId,
  });
}
