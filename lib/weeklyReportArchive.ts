import { findOrCreateFolder, uploadHtmlAsPdf } from "@/lib/googleDrive";
import { weekRangeLabel } from "@/lib/date";
import type { WeeklyReport } from "@/lib/types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function listHtml(items: string[]): string {
  if (items.length === 0) {
    return `<p style="color:#888;">작성된 내용이 없습니다.</p>`;
  }
  const lis = items
    .map((item) => `<li>${escapeHtml(item).replace(/\n/g, "<br/>")}</li>`)
    .join("");
  return `<ol style="margin:0 0 12px 0; padding-left:20px;">${lis}</ol>`;
}

function sectionHtml(icon: string, label: string, items: string[]): string {
  return `
    <h2 style="font-size:15px; margin:16px 0 6px 0;">${icon} ${label}</h2>
    ${listHtml(items)}
  `;
}

// 서버(크론)에는 브라우저가 없어 html2canvas 같은 화면 캡처는 쓸 수 없다.
// 대신 HTML로 업로드해서 구글독스가 자동 변환하게 하면(uploadHtmlAsPdf)
// 제목/표/굵게 서식이 살아있는, 텍스트 나열보다 훨씬 화면에 가까운
// PDF가 나온다.
export async function archiveWeeklyReportToDrive(
  report: WeeklyReport,
  storeName: string
): Promise<void> {
  const rootParentId = process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID || "root";
  const weeklyRootId = await findOrCreateFolder("주간보고", rootParentId);
  const storeFolderId = await findOrCreateFolder(storeName, weeklyRootId);

  const weekLabel = weekRangeLabel(report.week_start);

  let salesTableHtml = "";
  if (report.sales_table.length > 0) {
    const rows = report.sales_table
      .map(
        (row) => `
        <tr>
          <td style="border:1px solid #ccc; padding:6px 10px;">${escapeHtml(row.label)}</td>
          <td style="border:1px solid #ccc; padding:6px 10px; color:#888;">${escapeHtml(row.lastWeek)}</td>
          <td style="border:1px solid #ccc; padding:6px 10px;">${escapeHtml(row.thisWeek)}</td>
        </tr>`
      )
      .join("");
    salesTableHtml = `
      <table style="border-collapse:collapse; margin-top:8px;">
        <tr>
          <th style="border:1px solid #ccc; padding:6px 10px; text-align:left;">항목</th>
          <th style="border:1px solid #ccc; padding:6px 10px; text-align:left;">전주</th>
          <th style="border:1px solid #ccc; padding:6px 10px; text-align:left;">금주</th>
        </tr>
        ${rows}
      </table>`;
  }

  const html = `
    <html>
      <body style="font-family: 'Noto Sans KR', sans-serif; color:#1c2624;">
        <h1 style="font-size:20px; margin-bottom:2px;">${escapeHtml(storeName)}</h1>
        <p style="color:#666; margin-top:0;">${escapeHtml(weekLabel)} 주간보고</p>
        <hr style="border:none; border-top:1px solid #ddd;" />

        ${sectionHtml("🎯", "주간목표", report.goals)}
        ${sectionHtml("👥", "HR - 진행상황", report.hr_items)}

        <h2 style="font-size:15px; margin:16px 0 6px 0;">💰 매출</h2>
        ${listHtml(report.sales_notes)}
        ${salesTableHtml}

        ${sectionHtml("⭐", "주간이슈", report.issues)}
        ${sectionHtml("🍳", "키친", report.kitchen_items)}
        ${sectionHtml("🍽️", "홀", report.hall_items)}
      </body>
    </html>
  `;

  await uploadHtmlAsPdf({
    name: `[${report.week_start}] ${weekLabel} 주간보고`,
    html,
    parentId: storeFolderId,
  });
}
