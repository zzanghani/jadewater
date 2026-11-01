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

// 광고 효율 숫자(토스 매출 × 네이버 광고)를 읽고 이번 주 전략 메모를 쓴다.
// 화면에서 카드로 나눠 보여주려고 JSON으로 받고, 숫자에 없는 건 지어내지 않게 한다.
// 긴 문장은 폰에서 읽기 힘들어 한 항목을 짧게, 숫자는 만원 단위로 쓰게 한다.
import { parseAdStrategyMemo } from "@/lib/adStrategyMemo";

export async function generateAdStrategy(dataText: string, apiKey: string): Promise<string | null> {
  const prompt = `너는 레스토랑 체인의 네이버 검색광고를 운영하는 퍼포먼스 마케터야. 아래는 한 매장의 토스포스 매출과 네이버 검색광고 성과야.

${dataText}

위 숫자만 근거로 한국어로 써줘. 데이터에 없는 건 추측하지 마. 점장이 폰으로 읽는 화면이라 다음 규칙을 지켜:
- 각 문장은 40자 안팎, 한 항목에 한 문장만.
- 금액은 만원 단위로 반올림 (예: 1,030만원, 6.6만원). 원 단위 긴 숫자 금지.
- ROAS는 퍼센트 대신 "광고비 1만원당 매출 N만원"으로 써.
- 전문 용어(CPC, ROAS, 전환 추적) 대신 쉬운 말(클릭 한 번 값, 광고비 대비 매출, 예약·전화 집계).

아래 JSON 형식 그대로만 출력해. 설명이나 코드 블록 없이 JSON만:
{
  "headline": "광고가 매출로 이어지고 있는지 한 문장",
  "good": ["좋은 점 1", "좋은 점 2"],
  "issues": ["문제 1", "문제 2"],
  "actions": [
    { "title": "무엇을 (짧은 제목)", "amount": "얼마나 (숫자 포함 한 문장)", "why": "왜 (근거 숫자 한 문장)" },
    { "title": "...", "amount": "...", "why": "..." },
    { "title": "...", "amount": "...", "why": "..." }
  ],
  "budget": { "verdict": "유지 또는 증액 또는 감액", "range": "일 광고비 금액 범위", "why": "근거 한 문장" }
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1200, thinking: { type: "disabled" }, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim() || null;
  if (!text) return null;
  // JSON이 깨져 왔으면 원문을 그대로 저장해 화면에서 텍스트로라도 보여준다.
  const parsed = parseAdStrategyMemo(text);
  return parsed ? JSON.stringify(parsed) : text;
}

// 체험단(리뷰노트) 모집글 초안 — 키워드 3개와 블로거용 제목·본문 작성 가이드.
// 지난 회차 가이드의 톤과 매장 특징은 살리되, 같은 키워드만 반복하지 않게
// 회차마다 조합을 바꾼다. 매장에 대한 사실은 입력에 있는 것만 쓴다.
export type RecruitPostInput = {
  storeName: string;
  offer: string;
  currentKeywords: string[];
  currentInformation: string;
  previous: { keywords: string[]; information: string }[];
};

export async function draftRecruitPost(
  input: RecruitPostInput,
  apiKey: string
): Promise<{ keywords: string[]; information: string } | null> {
  const prevText = input.previous
    .map((p, i) => `[${i + 1}회 전] 키워드: ${p.keywords.join(", ") || "-"}\n${p.information || "(가이드 없음)"}`)
    .join("\n\n");
  const prompt = `너는 레스토랑의 블로그 체험단(리뷰노트) 모집글을 쓰는 마케터야.

매장: ${input.storeName}
제공 내역: ${input.offer || "-"}
지금 입력된 키워드: ${input.currentKeywords.join(", ") || "-"}
지금 입력된 작성 가이드:
${input.currentInformation || "(없음)"}

지난 회차 모집글:
${prevText || "(없음)"}

이번 회차 모집글을 새로 써줘. 규칙:
- 매장 특징·메뉴·수상 이력 같은 사실은 위 글에 있는 것만 써. 새로 지어내지 마.
- 키워드는 손님이 네이버에서 실제로 칠 만한 "지역+상황+맛집" 형태로 3개. 지난 회차와 같은 조합만 반복하지 말고 최소 1개는 바꿔.
- 작성 가이드는 [제목 가이드] / [본문 작성 가이드] 구조로, 블로거가 바로 따라 쓸 수 있게 짧은 줄로.
- 광고 문구처럼 과장하지 말고, 블로거가 솔직한 후기를 쓰게 유도해.

아래 JSON 형식 그대로만 출력해. 설명이나 코드 블록 없이 JSON만:
{ "keywords": ["키워드1", "키워드2", "키워드3"], "information": "작성 가이드 전문 (줄바꿈은 \\n)" }`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1500, thinking: { type: "disabled" }, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim();
  if (!text) return null;
  try {
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { keywords?: unknown; information?: unknown };
    const keywords = Array.isArray(json.keywords) ? json.keywords.filter((k): k is string => typeof k === "string").slice(0, 3) : [];
    const information = typeof json.information === "string" ? json.information : "";
    if (!information) return null;
    return { keywords, information };
  } catch {
    return null;
  }
}
