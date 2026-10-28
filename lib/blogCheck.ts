// 체험단 지원자 블로그 검증.
// 블로그 주소만 가지고 네이버에서 공개된 정보를 읽어 점수를 매긴다.
// - 블로그 정보(하루 방문자·이웃 수·블로그 주제): m.blog.naver.com/rego/BlogInfo.naver
// - 최근 글 30개(제목·카테고리·본문 앞부분·작성일·내돈내산 표시): m.blog.naver.com/api/blogs/{id}/post-list
// - 검색 노출: 최근 글 제목을 그대로 네이버 블로그 검색(공식 검색 API)에 넣어
//   상위 10개 안에 그 글이 나오는지 본다. 저품질(검색 누락) 블로그는 제목을
//   그대로 쳐도 안 나온다.
// 리뷰노트가 주는 값(노출점수·5일 평균 방문자·페널티·취소)도 같이 반영한다.

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export type ReviewnoteInfo = {
  applyId?: string | null;
  exposureScore?: number | null; // 리뷰노트 노출점수 (0~100)
  avgVisit?: number | null; // 리뷰노트 5일 평균 방문자
  penaltyCount?: number | null;
  cancelCount?: number | null;
  valuation?: string | null; // lv1~lv5
  isInfluence?: boolean | null;
};

export type BlogMetrics = {
  found: boolean;
  blogName: string | null;
  directory: string | null; // 네이버가 정한 블로그 주제 ("맛집" 등)
  dayVisitors: number | null;
  subscribers: number | null;
  totalVisitors: number | null;
  postsChecked: number;
  posts30d: number; // 최근 30일 글 수
  lastPostDays: number | null; // 마지막 글이 며칠 전인지
  foodRatio: number | null; // 0~1
  sponsoredRatio: number | null; // 0~1
  searchChecked: number;
  searchExposed: number;
  samplePosts: { title: string; url: string; food: boolean; sponsored: boolean; exposed: boolean | null }[];
  error?: string;
};

export type BlogVerdict = { score: number; grade: "A" | "B" | "C"; flags: string[] };

/** 아무 텍스트(주소 목록·복사한 표)에서 네이버 블로그 아이디를 뽑는다. */
export function extractBlogIds(text: string): string[] {
  const ids = new Set<string>();
  const re = /(?:m\.)?blog\.naver\.com\/(?:PostList\.naver\?blogId=|PostView\.naver\?blogId=)?([A-Za-z0-9_-]{3,30})/g;
  for (const m of text.matchAll(re)) {
    const id = m[1];
    if (!/^(PostList|PostView|prologue|SympathyHistoryList)$/i.test(id)) ids.add(id.toLowerCase());
  }
  return [...ids];
}

const FOOD_WORDS = [
  "맛집", "식당", "카페", "디저트", "브런치", "레스토랑", "파스타", "스테이크", "와인", "술집", "이자카야", "오마카세",
  "고기", "한식", "양식", "일식", "중식", "베이커리", "빵집", "메뉴", "맛있", "런치", "디너", "점심", "저녁", "웨이팅",
  "코스요리", "다이닝", "비스트로", "포차", "횟집", "국밥", "삼겹", "갈비", "초밥", "라멘", "피자", "버거", "커피",
];
const SPONSOR_WORDS = [
  "체험단", "협찬", "제공받", "원고료", "소정의", "업체로부터", "지원받아", "무상으로", "무료로 제공", "리뷰노트", "레뷰",
  "강남맛집", "디너의여왕", "서울오빠", "미블", "링블", "체험뷰", "모두의블로그", "리뷰플레이스", "포블로그", "놀러와체험단",
];

const countHits = (text: string, words: string[]) => words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);

function cleanTitle(t: string) {
  return t.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

async function getJson(url: string, referer: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Referer: referer }, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // BlogInfo는 앞에 ")]}'," 가 붙어 온다.
  const text = (await res.text()).replace(/^\)\]\}',?\s*/, "");
  return JSON.parse(text);
}

type PostItem = {
  logNo: number;
  titleWithInspectMessage: string;
  categoryName?: string | null;
  briefContents?: string | null;
  addDate: number;
  buyWithMyOwnMoney?: boolean;
};

async function isExposed(blogId: string, logNo: number, title: string): Promise<boolean | null> {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return null;
  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(title)}&display=10&sort=sim`;
  const res = await fetch(url, { headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret }, cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: { link: string }[] };
  const needle = `/${blogId.toLowerCase()}/${logNo}`;
  return (data.items ?? []).some((it) => it.link.toLowerCase().includes(needle));
}

export async function fetchBlogMetrics(blogId: string): Promise<BlogMetrics> {
  const empty: BlogMetrics = {
    found: false, blogName: null, directory: null, dayVisitors: null, subscribers: null, totalVisitors: null,
    postsChecked: 0, posts30d: 0, lastPostDays: null, foodRatio: null, sponsoredRatio: null,
    searchChecked: 0, searchExposed: 0, samplePosts: [],
  };
  const referer = `https://m.blog.naver.com/${blogId}`;
  let info: Record<string, unknown> | null = null;
  let items: PostItem[] = [];
  try {
    const [i, p] = await Promise.all([
      getJson(`https://m.blog.naver.com/rego/BlogInfo.naver?blogId=${encodeURIComponent(blogId)}`, referer),
      getJson(`https://m.blog.naver.com/api/blogs/${encodeURIComponent(blogId)}/post-list?categoryNo=0&itemCount=30&page=1`, referer),
    ]);
    info = ((i as { result?: Record<string, unknown> })?.result ?? null) as Record<string, unknown> | null;
    items = ((p as { result?: { items?: PostItem[] } })?.result?.items ?? []) as PostItem[];
  } catch (e) {
    return { ...empty, error: `네이버 블로그를 읽지 못했어요 (${(e as Error).message})` };
  }
  if (!info) return { ...empty, error: "없는 블로그이거나 비공개예요" };

  const now = Date.now();
  const day = 86400000;
  const directory = (info.blogDirectoryName as string) || null;
  const posts = items.map((it) => {
    const title = cleanTitle(it.titleWithInspectMessage ?? "");
    const head = `${title} ${it.categoryName ?? ""}`;
    const brief = it.briefContents ?? "";
    const food = countHits(head, FOOD_WORDS) > 0 || countHits(brief, FOOD_WORDS) >= 2;
    const sponsored = !it.buyWithMyOwnMoney && countHits(`${head} ${brief}`, SPONSOR_WORDS) > 0;
    return { ...it, title, food, sponsored, ageDays: (now - it.addDate) / day };
  });

  // 검색 노출 — 이틀 이상 지나서 검색에 반영됐을 글 중 최근 3개.
  const targets = posts.filter((p) => p.ageDays >= 2 && p.title.length >= 6).slice(0, 3);
  const exposure = await Promise.all(targets.map((p) => isExposed(blogId, p.logNo, p.title).catch(() => null)));
  const exposedMap = new Map(targets.map((p, i) => [p.logNo, exposure[i]]));
  const checked = exposure.filter((x) => x !== null);

  const n = posts.length;
  return {
    found: true,
    blogName: (info.blogName as string) ?? null,
    directory,
    dayVisitors: typeof info.dayVisitorCount === "number" ? info.dayVisitorCount : null,
    subscribers: typeof info.subscriberCount === "number" ? info.subscriberCount : null,
    totalVisitors: typeof info.totalVisitorCount === "number" ? info.totalVisitorCount : null,
    postsChecked: n,
    posts30d: posts.filter((p) => p.ageDays <= 30).length,
    lastPostDays: n ? Math.floor(Math.min(...posts.map((p) => p.ageDays))) : null,
    foodRatio: n ? posts.filter((p) => p.food).length / n : null,
    sponsoredRatio: n ? posts.filter((p) => p.sponsored).length / n : null,
    searchChecked: checked.length,
    searchExposed: checked.filter(Boolean).length,
    samplePosts: posts.slice(0, 5).map((p) => ({
      title: p.title,
      url: `https://blog.naver.com/${blogId}/${p.logNo}`,
      food: p.food,
      sponsored: p.sponsored,
      exposed: exposedMap.has(p.logNo) ? (exposedMap.get(p.logNo) ?? null) : null,
    })),
  };
}

/**
 * 100점 만점. 대표님 기준(맛집 위주 · 검색 노출 · 협찬 과다)에 가장 큰 비중을 둔다.
 * - 맛집 비중 30 · 검색 노출 35(우리 확인 25 + 리뷰노트 노출점수 10) · 협찬 과다 15 · 방문자·활동 20
 * - 리뷰노트 페널티 1회당 -10, 취소 1회당 -5
 */
export function scoreBlog(m: BlogMetrics, rn: ReviewnoteInfo | null): BlogVerdict {
  const flags: string[] = [];
  if (!m.found) return { score: 0, grade: "C", flags: [m.error ?? "블로그를 읽지 못함"] };

  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  let score = 0;

  // 맛집 비중: 60% 이상이면 만점. 네이버 주제가 '맛집'이면 최소 절반.
  const food = Math.max(m.foodRatio ?? 0, m.directory === "맛집" ? 0.5 : 0);
  score += 30 * clamp(food / 0.6);
  if (food < 0.3) flags.push("맛집 글 적음");

  // 검색 노출
  const rnExp = rn?.exposureScore;
  if (m.searchChecked > 0) {
    const ratio = m.searchExposed / m.searchChecked;
    score += 25 * ratio;
    if (m.searchExposed === 0) flags.push("검색 누락(저품질 의심)");
    else if (ratio < 0.5) flags.push("검색 노출 약함");
    score += 10 * clamp((rnExp ?? ratio * 100) / 100);
  } else {
    score += 35 * clamp((rnExp ?? 50) / 100);
  }
  if (rnExp != null && rnExp < 50) flags.push(`리뷰노트 노출점수 ${rnExp}`);

  // 협찬 과다: 30% 이하면 만점, 80% 이상이면 0.
  const sp = m.sponsoredRatio ?? 0;
  score += 15 * clamp((0.8 - sp) / 0.5);
  if (sp >= 0.6) flags.push("협찬 글 과다");

  // 방문자(10) — 리뷰노트 5일 평균이 있으면 그걸, 없으면 네이버 오늘 방문자.
  const visits = rn?.avgVisit ?? m.dayVisitors ?? 0;
  score += 10 * clamp(Math.log10(Math.max(visits, 1)) / Math.log10(500));
  if (visits < 50) flags.push("방문자 적음");

  // 활동(10) — 최근 30일 8개 이상이면 만점.
  score += 10 * clamp(m.posts30d / 8);
  if (m.lastPostDays != null && m.lastPostDays > 30) flags.push(`${m.lastPostDays}일째 글 없음`);

  const pen = rn?.penaltyCount ?? 0;
  const can = rn?.cancelCount ?? 0;
  if (pen > 0) flags.push(`리뷰노트 페널티 ${pen}회`);
  if (can > 0) flags.push(`취소 ${can}회`);
  score -= pen * 10 + can * 5;

  // 리뷰노트 노출점수가 아주 낮으면(30 미만) 다른 점수가 좋아도 C로 내린다.
  if (rnExp != null && rnExp < 30) score = Math.min(score, 50);

  const s = Math.max(0, Math.min(100, Math.round(score)));
  return { score: s, grade: s >= 80 ? "A" : s >= 60 ? "B" : "C", flags };
}
