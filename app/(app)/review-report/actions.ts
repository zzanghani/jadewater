"use server";

import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { fetchReviewReports } from "@/lib/reviewReport";
import { sendEmail } from "@/lib/email";

const REVIEW_REPORT_TO = "lee@bestmateco.com";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 선택한 날짜의 리뷰 리포트를 전 매장분 한 통으로 묶어 메일로 보낸다.
export async function sendReviewReportEmail(
  date: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "날짜가 올바르지 않습니다." };

  const { stores } = await getStoreContext(supabase);
  if (stores.length === 0) return { error: "볼 수 있는 매장이 없습니다." };

  const reports = await fetchReviewReports(
    supabase,
    stores.map((s) => s.id),
    [date]
  );
  const byStore = reports[date] ?? {};

  const [y, m, d] = date.split("-").map(Number);
  const dateLabel = `${y}년 ${m}월 ${d}일`;

  let totalNew = 0;
  let totalBlog = 0;
  const sections = stores.map((store) => {
    const r = byStore[store.id];
    const platforms = r?.platforms ?? [];
    const newReviews = r?.newReviews ?? [];
    const blogPosts = r?.blogPosts ?? [];
    totalNew += newReviews.length;
    totalBlog += blogPosts.length;

    const platformHtml = platforms.length
      ? `<p style="margin:0 0 8px;font-size:13px;color:#374151">${platforms
          .map(
            (p) =>
              `${escapeHtml(p.name)} ★${p.rating} · ${p.count.toLocaleString()}건${
                p.change > 0 ? ` <b style="color:#15803d">(+${p.change})</b>` : ""
              }`
          )
          .join(" &nbsp;|&nbsp; ")}</p>`
      : "";

    const reviewHtml = newReviews.length
      ? `<ul style="margin:0 0 10px;padding-left:18px">${newReviews
          .map(
            (rv) =>
              `<li style="font-size:13px;color:#374151;margin-bottom:4px">${
                rv.rating <= 3 ? "⚠️ " : ""
              }★${rv.rating} ${escapeHtml(rv.body ?? "")}</li>`
          )
          .join("")}</ul>`
      : `<p style="margin:0 0 10px;font-size:13px;color:#9ca3af">새 리뷰 없음</p>`;

    const blogHtml = blogPosts.length
      ? `<ul style="margin:0 0 10px;padding-left:18px">${blogPosts
          .map(
            (b) =>
              `<li style="font-size:13px;margin-bottom:4px"><a href="${escapeHtml(
                b.url
              )}" style="color:#1d4ed8;text-decoration:none">${escapeHtml(
                b.title
              )}</a> <span style="color:#9ca3af">· ${escapeHtml(b.blogger_name ?? "")}</span></li>`
          )
          .join("")}</ul>`
      : `<p style="margin:0 0 10px;font-size:13px;color:#9ca3af">새 블로그 후기 없음</p>`;

    const aiHtml = r?.analysis
      ? `<div style="background:#f3f4f6;border-radius:8px;padding:10px 12px;font-size:13px;color:#374151;white-space:pre-wrap">🤖 ${escapeHtml(
          r.analysis
        )}</div>`
      : "";

    return `<div style="margin:0 0 22px;padding:0 0 18px;border-bottom:1px solid #e5e7eb">
  <h3 style="margin:0 0 6px;font-size:15px">${escapeHtml(store.name)}</h3>
  ${platformHtml}
  <p style="margin:10px 0 4px;font-size:12px;font-weight:600;color:#6b7280">새 리뷰 ${newReviews.length}건</p>
  ${reviewHtml}
  <p style="margin:10px 0 4px;font-size:12px;font-weight:600;color:#6b7280">블로그 후기 ${blogPosts.length}건</p>
  ${blogHtml}
  ${aiHtml}
</div>`;
  });

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#111827;max-width:680px">
  <h2 style="margin:0 0 4px;font-size:18px">⭐ ${escapeHtml(dateLabel)} 리뷰 리포트</h2>
  <p style="margin:0 0 18px;font-size:13px;color:#6b7280">${stores.length}개 매장 · 새 리뷰 ${totalNew}건 · 블로그 후기 ${totalBlog}건</p>
  ${sections.join("")}
  <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">베스트메이트컴퍼니 앱에서 보낸 메일입니다.</p>
</div>`;

  const { error } = await sendEmail({
    to: REVIEW_REPORT_TO,
    subject: `[리뷰리포트] ${dateLabel} (새 리뷰 ${totalNew} · 블로그 ${totalBlog})`,
    html,
  });
  if (error) return { error };
  return { success: true };
}
