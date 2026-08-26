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
      max_tokens: 1024,
      thinking: { type: "disabled" },
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

// 사건 기록 한 줄을 읽고 어느 평가 문항에 해당하는지 골라준다.
// 점장이 분류를 직접 고르게 하면 입력이 느려져 아무도 안 쓰게 되므로,
// 일단 자동으로 붙이고 틀리면 화면에서 고치게 한다.
// 목록에 없는 값이 오면 호출한 쪽에서 걸러내므로 여기선 원문만 돌려준다.
export async function classifyEmployeeRecord(
  body: string,
  items: readonly string[],
  apiKey: string
): Promise<string | null> {
  const prompt = `아래는 식당 매장에서 관리자가 직원에 대해 남긴 기록 한 줄이야.

기록: ${body}

이 기록이 아래 근무평가 문항 중 어디에 가장 가까운지 하나만 골라줘.

${items.map((i) => `- ${i}`).join("\n")}

규칙:
- 목록에 있는 문항 이름을 토씨 하나 틀리지 않고 그대로만 출력해.
- 설명, 따옴표, 번호, 앞뒤 말 없이 문항 이름만 한 줄로 출력해.
- 어디에도 뚜렷하게 해당하지 않으면 없음 이라고만 출력해.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 64,
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim();
  if (!text || text === "없음") return null;
  return text;
}
