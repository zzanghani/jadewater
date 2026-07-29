export type ReviewSummaryInput = {
  storeName: string;
  platforms: { name: string; rating: number; count: number; change: number }[];
  newReviews: { platform: string; rating: number; body: string }[];
  blogPosts: { title: string; body: string | null }[];
};

const CLAUDE_MODEL = "claude-sonnet-5";

// 오늘 수집된 리뷰/블로그 데이터를 근거로 "칭찬한 점 / 불만·개선할 점 / 오늘 실천 제안"
// 형식의 한국어 요약을 생성한다. 데이터가 근거 없이 지어내지 않도록 프롬프트에서 제한한다.
export async function generateReviewSummary(
  input: ReviewSummaryInput,
  apiKey: string
): Promise<string | null> {
  const platformLines = input.platforms
    .map(
      (p) =>
        `- ${p.name}: 평점 ${p.rating}, 누적 ${p.count}건 (전일 대비 ${
          p.change > 0 ? `+${p.change}` : "0"
        }건)`
    )
    .join("\n");
  const reviewLines = input.newReviews
    .map((r) => `- [${r.platform} ${r.rating}점] ${r.body}`)
    .join("\n");
  const blogLines = input.blogPosts
    .map((p) => `- ${p.title}${p.body ? `: ${p.body}` : ""}`)
    .join("\n");

  const prompt = `너는 요식업 매장 운영을 돕는 분석가야. 아래는 "${input.storeName}"의 오늘 수집된 데이터야.

[플랫폼 통계]
${platformLines || "(데이터 없음)"}

[오늘 새로 달린 리뷰]
${reviewLines || "(없음)"}

[오늘 새로 발견된 블로그 후기]
${blogLines || "(없음)"}

위 데이터만 근거로, 아래 형식을 정확히 지켜서 한국어로 요약해줘. 데이터에 없는 내용은 추측해서 쓰지 마.

1) [한 줄 헤드라인]

2) 칭찬한 점
– ...

3) 불만/개선할 점
– ...

4) 오늘 실천 제안
– ...`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };

  return data.content?.find((c) => c.type === "text")?.text?.trim() || null;
}
