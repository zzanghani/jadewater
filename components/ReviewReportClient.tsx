"use client";

import { useState, type CSSProperties } from "react";
import type { ReviewReportsByDate } from "@/lib/reviewReport";

type StoreInfo = { id: string; name: string; color: string };
type DateEntry = { date: string; tabLabel: string; titleLabel: string };

export default function ReviewReportClient({
  stores,
  dates,
  reports,
}: {
  stores: StoreInfo[];
  dates: DateEntry[];
  reports: ReviewReportsByDate;
}) {
  const [selectedDate, setSelectedDate] = useState(dates[0]?.date ?? "");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    stores[0] ? { [stores[0].id]: true } : {}
  );
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const report = reports[selectedDate];
  const selectedTitle = dates.find((d) => d.date === selectedDate)?.titleLabel ?? "";

  const badReviewEntries = report
    ? stores.flatMap((store) =>
        (report[store.id]?.badReviews ?? []).map((r) => ({ store, ...r }))
      )
    : [];

  function toggle(id: string) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }

  function handleRequestNow() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setToast("📧 리포트 이메일을 발송했어요!");
      setTimeout(() => setToast(""), 3000);
    }, 2000);
  }

  return (
    <div style={s.page}>
      {/* ── 날짜 탭 헤더 ── */}
      <div style={s.header}>
        <h1 style={s.title}>⭐ 리뷰 리포트</h1>
        <div style={s.tabRow}>
          {dates.map((d) => (
            <button
              key={d.date}
              onClick={() => setSelectedDate(d.date)}
              style={{
                ...s.tab,
                ...(selectedDate === d.date ? s.tabActive : {}),
              }}
            >
              {d.tabLabel}
            </button>
          ))}
        </div>
      </div>

      {/* ── 본문 ── */}
      <div style={s.body}>
        <p style={s.dateLabel}>{selectedTitle}</p>

        {/* 상태 배너 */}
        {badReviewEntries.length === 0 ? (
          <div style={{ ...s.banner, background: "#e8f9e9", color: "#1a7a2e" }}>
            ✅ 나쁜 리뷰 없음! 좋은 하루의 시작이에요.
          </div>
        ) : (
          <div style={{ ...s.banner, background: "#fff0f0", border: "1px solid #ffcccc" }}>
            <div style={{ color: "#cc0000", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              ⚠️ 주의가 필요한 리뷰 {badReviewEntries.length}건
            </div>
            {badReviewEntries.map((r) => (
              <div key={r.id} style={s.badCard}>
                <div style={s.badMeta}>
                  {r.store.name} · {r.platform} · {"⭐".repeat(r.rating)} {r.rating}점
                </div>
                {r.body}
              </div>
            ))}
          </div>
        )}

        {/* 매장 카드 */}
        {stores.map((store) => {
          const data = report?.[store.id];
          const isOpen = !!expanded[store.id];
          const newCount = data?.newReviews.length ?? 0;
          const hasBad = (data?.badReviews.length ?? 0) > 0;

          return (
            <div key={store.id} style={s.card}>
              {/* 카드 헤더 */}
              <button
                onClick={() => toggle(store.id)}
                style={{ ...s.cardHeader, background: store.color }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>{store.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {newCount > 0 && <span style={s.newBadge}>새 리뷰 {newCount}건</span>}
                  {hasBad && (
                    <span style={{ ...s.newBadge, background: "rgba(255,80,80,0.4)" }}>⚠️</span>
                  )}
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>
                    {isOpen ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {/* 카드 내용 */}
              {isOpen && (
                <div style={s.cardBody}>
                  {/* 플랫폼 테이블 */}
                  {data && data.platforms.length > 0 ? (
                    <table style={s.table}>
                      <thead>
                        <tr>
                          {["플랫폼", "평점", "리뷰 수", "변화"].map((h) => (
                            <th key={h} style={s.th}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.platforms.map((p) => (
                          <tr key={p.name}>
                            <td style={s.td}>{p.name}</td>
                            <td style={s.td}>⭐ {p.rating}</td>
                            <td style={s.td}>{p.count.toLocaleString()}</td>
                            <td
                              style={{
                                ...s.td,
                                color: p.change > 0 ? "#16a34a" : "#bbb",
                                fontWeight: p.change > 0 ? 600 : 400,
                              }}
                            >
                              {p.change > 0 ? `+${p.change}건` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: "#ccc", fontSize: 13, marginBottom: 12 }}>
                      집계된 플랫폼 데이터가 없습니다.
                    </p>
                  )}

                  {/* 새 리뷰 */}
                  {newCount > 0 ? (
                    <div style={{ marginBottom: 12 }}>
                      <div style={s.sectionLabel}>💬 새로 달린 리뷰 ({newCount}건)</div>
                      {data!.newReviews.map((r) => (
                        <div key={r.id} style={s.reviewCard}>
                          <div style={s.reviewMeta}>
                            {r.platform} · {"⭐".repeat(r.rating)} {r.rating}점
                          </div>
                          {r.body}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: "#ccc", fontSize: 13, marginBottom: 12 }}>
                      새로 달린 리뷰가 없습니다.
                    </p>
                  )}

                  {/* 블로그 후기 */}
                  {data && data.blogPosts.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={s.sectionLabel}>
                        📝 새로 달린 블로그 후기 ({data.blogPosts.length}건)
                      </div>
                      {data.blogPosts.map((p) => (
                        <div key={p.id} style={s.blogCard}>
                          <div style={s.reviewMeta}>
                            네이버 블로그 · {p.blogger_name ?? "익명"}
                            {p.posted_at ? ` · ${p.posted_at}` : ""}
                          </div>
                          <div style={s.blogTitle}>{p.title}</div>
                          {p.body && <div style={{ marginTop: 2 }}>{p.body}</div>}
                          <a href={p.url} target="_blank" rel="noreferrer" style={s.blogLink}>
                            📝 블로그 글 보러가기
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI 분석 */}
                  {data?.analysis ? (
                    <div style={s.aiBox}>
                      <div style={s.aiTitle}>🤖 AI 요약 &amp; 제안</div>
                      {data.analysis}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 하단 고정 버튼 ── */}
      <div style={s.fixedBottom}>
        <button
          onClick={handleRequestNow}
          disabled={loading}
          style={{ ...s.cta, background: loading ? "#999" : "#111" }}
        >
          {loading ? "📧 발송 중..." : "📧 지금 이메일 리포트 받기"}
        </button>
      </div>

      {/* ── 토스트 알림 ── */}
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────
// 스타일 모음
// ──────────────────────────────────────────────
const s: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#f5f5f5", paddingBottom: 100 },
  header: {
    background: "#fff",
    padding: "16px 20px 0",
    borderBottom: "1px solid #eee",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  title: { fontSize: 18, fontWeight: 700, margin: "0 0 14px" },
  tabRow: { display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 0 },
  tab: {
    flexShrink: 0,
    padding: "8px 14px",
    border: "none",
    background: "transparent",
    color: "#aaa",
    fontSize: 13,
    fontWeight: 400,
    cursor: "pointer",
    borderRadius: "20px 20px 0 0",
    whiteSpace: "nowrap",
  },
  tabActive: { background: "#111", color: "#fff", fontWeight: 600 },

  body: { padding: "16px" },
  dateLabel: { fontSize: 13, color: "#888", marginBottom: 12 },

  banner: { borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 14 },
  badCard: { background: "#fff", borderRadius: 8, padding: "10px 12px", marginTop: 6, fontSize: 13, lineHeight: 1.6 },
  badMeta: { color: "#888", fontSize: 11, marginBottom: 4 },

  card: { background: "#fff", borderRadius: 12, marginBottom: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" },
  cardHeader: {
    width: "100%",
    color: "#fff",
    border: "none",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    textAlign: "left",
  },
  cardBody: { padding: "14px 16px" },

  newBadge: { background: "rgba(255,255,255,0.3)", borderRadius: 10, padding: "2px 8px", fontSize: 12, color: "#fff" },

  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 14 },
  th: { padding: "6px 8px", textAlign: "left", color: "#aaa", fontWeight: 600, fontSize: 12, borderBottom: "2px solid #eee" },
  td: { padding: "8px 8px", borderBottom: "1px solid #f5f5f5" },

  sectionLabel: { fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#333" },
  reviewCard: { background: "#fafafa", borderRadius: 8, padding: "10px 12px", marginBottom: 6, fontSize: 13, lineHeight: 1.6 },
  reviewMeta: { color: "#888", fontSize: 11, marginBottom: 4 },

  blogCard: { background: "#fafafa", borderRadius: 8, padding: "10px 12px", marginBottom: 6, fontSize: 13, lineHeight: 1.6 },
  blogTitle: { fontWeight: 600, color: "#222" },
  blogLink: { display: "inline-block", marginTop: 6, fontSize: 12, color: "#2563eb", textDecoration: "none" },

  aiBox: { background: "#f0f4ff", borderRadius: 8, padding: "12px 14px", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-line" },
  aiTitle: { fontWeight: 700, marginBottom: 6, fontSize: 13 },

  fixedBottom: { position: "fixed", bottom: 65, left: 0, right: 0, padding: "0 16px" },
  cta: {
    width: "100%",
    padding: "14px",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  },

  toast: {
    position: "fixed",
    bottom: 130,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#111",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: 20,
    fontSize: 14,
    whiteSpace: "nowrap",
    zIndex: 100,
  },
};
