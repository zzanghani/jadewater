import { parseReviewSummary, type ReviewPoint } from "@/lib/reviewSummary";

// 리뷰 리포트의 AI 요약 카드: 한 줄 요약 → 긍정(녹색) → 부정(적색) → 오늘 할 일.
// 예전 글 형식 요약도 lib/reviewSummary 가 같은 구조로 풀어 준다. 그래도 못 풀면 글 그대로 보여준다.
export default function ReviewSummaryCard({ raw }: { raw: string }) {
  const m = parseReviewSummary(raw);
  if (!m) {
    return (
      <div className="rounded-xl bg-[#f0f4ff] px-3.5 py-3 text-[13px] leading-relaxed">
        <p className="mb-1.5 font-bold">AI 요약 &amp; 제안</p>
        <p className="whitespace-pre-line">{raw.replace(/^#+\s*/gm, "").replace(/\*\*/g, "")}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold">AI 요약 &amp; 제안</p>
        <p className="flex gap-1.5 text-[11px] font-bold">
          <span className="rounded-full bg-green-600 px-2 py-0.5 text-white">긍정 {m.positives.length}</span>
          <span className={`rounded-full px-2 py-0.5 text-white ${m.negatives.length ? "bg-red-600" : "bg-gray-400"}`}>부정 {m.negatives.length}</span>
        </p>
      </div>

      {m.headline && <p className="rounded-xl bg-gray-900 px-3.5 py-2.5 text-[13px] font-semibold leading-snug text-white">{m.headline}</p>}

      <Panel tone="good" title="긍정 · 손님이 칭찬한 점" items={m.positives} empty="오늘 눈에 띄는 칭찬은 없었어요." />
      <Panel tone="bad" title="부정 · 불만과 아쉬운 점" items={m.negatives} empty="오늘 접수된 불만은 없어요." />

      {m.actions.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-3.5 py-3">
          <p className="mb-1.5 text-[11px] font-bold text-gray-500">오늘 할 일</p>
          <ol className="flex flex-col gap-1.5">
            {m.actions.map((a, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug text-gray-900">
                <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white">{i + 1}</span>
                <span>{a}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Panel({ tone, title, items, empty }: { tone: "good" | "bad"; title: string; items: ReviewPoint[]; empty: string }) {
  const good = tone === "good";
  const has = items.length > 0;
  return (
    <div className={`overflow-hidden rounded-xl border-2 ${good ? "border-green-600" : has ? "border-red-600" : "border-gray-300"}`}>
      <p className={`px-3.5 py-1.5 text-[12px] font-bold text-white ${good ? "bg-green-600" : has ? "bg-red-600" : "bg-gray-400"}`}>
        {good ? "▲" : "▼"} {title}
      </p>
      {has ? (
        <ul className={`flex flex-col gap-2 px-3.5 py-3 ${good ? "bg-green-50" : "bg-red-50"}`}>
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className={`mt-[3px] shrink-0 text-[12px] font-black ${good ? "text-green-600" : "text-red-600"}`}>{good ? "✓" : "!"}</span>
              <span className="min-w-0">
                <span className={`block text-[13px] font-bold leading-snug ${good ? "text-green-800" : "text-red-700"}`}>{it.point}</span>
                {it.detail && <span className={`mt-0.5 block text-[12px] leading-snug ${good ? "text-green-900/80" : "text-red-900/80"}`}>{it.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bg-gray-50 px-3.5 py-2.5 text-[12px] text-gray-500">{empty}</p>
      )}
    </div>
  );
}
