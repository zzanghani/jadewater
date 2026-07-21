export type NaverBlogPost = {
  title: string;
  url: string;
  body: string;
  bloggerName: string;
  postedAt: string; // 'YYYY-MM-DD'
};

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}

// 네이버 검색 API(블로그)로 검색어에 해당하는 블로그 글을 가져온다.
// https://developers.naver.com/docs/serviceapi/search/blog/blog.md
export async function fetchNaverBlogPosts(
  query: string,
  clientId: string,
  clientSecret: string,
  display = 100
): Promise<NaverBlogPost[]> {
  // sort=date(최신순)는 "하남"처럼 흔한 단어가 매장명에 들어가면 완전히 무관한
  // 글(부동산/주식 등)까지 끌려온다. sort=sim(관련도순)이 훨씬 정확하다.
  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(
    query
  )}&display=${display}&sort=sim`;

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!res.ok) {
    return [];
  }

  const data = (await res.json()) as {
    items?: {
      title: string;
      link: string;
      description: string;
      bloggername: string;
      postdate: string;
    }[];
  };

  return (data.items ?? []).map((item) => ({
    title: stripHtml(item.title),
    url: item.link,
    body: stripHtml(item.description),
    bloggerName: item.bloggername,
    postedAt: `${item.postdate.slice(0, 4)}-${item.postdate.slice(4, 6)}-${item.postdate.slice(6, 8)}`,
  }));
}

// 지점별 지역 키워드. 글 안에 어느 키워드가 가장 많이 나오는지로 그 글이
// 어느 지점 얘기인지 판별한다.
const BRANCH_KEYWORDS: [string, string[]][] = [
  ["옥수", ["옥수"]],
  ["서울역", ["서울역"]],
  ["성수", ["성수"]],
  ["하남", ["하남", "스타필드"]],
];

export function branchKeyForStoreName(storeName: string): string | null {
  return BRANCH_KEYWORDS.find(([key]) => storeName.includes(key))?.[0] ?? null;
}

function countOccurrences(text: string, keywords: string[]): number {
  return keywords.reduce((sum, k) => {
    if (!k) return sum;
    return sum + (text.split(k).length - 1);
  }, 0);
}

// "제이드앤워터"로 넓게 검색해 가져온 글들을, 어느 지점 얘기가 가장 많이
// 나오는지로 지점별로 분류한다. 브랜드명이 없거나 지점을 특정할 수 없으면
// (아무도 안 나오거나 여러 지점이 동점이면) 버린다.
export function classifyPostsByBranch(
  posts: NaverBlogPost[]
): Record<string, NaverBlogPost[]> {
  const result: Record<string, NaverBlogPost[]> = {};
  for (const [branch] of BRANCH_KEYWORDS) {
    result[branch] = [];
  }

  for (const post of posts) {
    const text = `${post.title} ${post.body}`;
    if (!text.includes("제이드")) continue;

    const counts = BRANCH_KEYWORDS.map(
      ([branch, keywords]) => [branch, countOccurrences(text, keywords)] as const
    );
    const maxCount = Math.max(...counts.map(([, c]) => c));
    if (maxCount === 0) continue;

    const winners = counts.filter(([, c]) => c === maxCount);
    if (winners.length !== 1) continue; // 동점(어느 지점인지 애매)이면 버린다

    result[winners[0][0]].push(post);
  }

  return result;
}
