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

// 브랜드 검색으로 가져온 글을 매장별로 나눈다.
//
// 예전에는 지점 키워드("옥수"/"서울역"/"성수"/"하남")를 이 파일에 하드코딩해
// 두고 매장 이름으로 찾았다. 정다미 서울역점이 생기면서 "서울역"이 두 브랜드에
// 겹쳐 제이드앤워터 서울역점 글이 정다미로 갈 수 있게 돼서, 키워드를
// stores.blog_keywords 컬럼으로 옮기고 분류를 브랜드 안에서만 하도록 바꿨다.
// (supabase/migration_brands.sql 참고)

export type BlogStore = {
  id: string;
  blog_keywords: string[];
};

function countOccurrences(text: string, keywords: string[]): number {
  return keywords.reduce((sum, k) => {
    if (!k) return sum;
    return sum + (text.split(k).length - 1);
  }, 0);
}

// matchToken은 그 브랜드 글인지 걸러내는 짧은 토큰이다("제이드" / "정다미").
// 브랜드에 매장이 하나뿐이면 나눌 것이 없으니 걸러진 글을 전부 그 매장에 준다.
// 매장이 여럿이면 지역 키워드가 가장 많이 나온 매장에 주고, 아무도 안 나오거나
// 동점이면(어느 지점인지 애매하면) 버린다.
export function classifyPostsByStore(
  posts: NaverBlogPost[],
  matchToken: string | null,
  stores: BlogStore[]
): Record<string, NaverBlogPost[]> {
  const result: Record<string, NaverBlogPost[]> = {};
  for (const store of stores) {
    result[store.id] = [];
  }
  if (stores.length === 0) return result;

  const matched = matchToken
    ? posts.filter((p) => `${p.title} ${p.body}`.includes(matchToken))
    : posts;

  if (stores.length === 1) {
    result[stores[0].id] = matched;
    return result;
  }

  for (const post of matched) {
    const text = `${post.title} ${post.body}`;
    const counts = stores.map(
      (store) => [store.id, countOccurrences(text, store.blog_keywords)] as const
    );
    const maxCount = Math.max(...counts.map(([, c]) => c));
    if (maxCount === 0) continue;

    const winners = counts.filter(([, c]) => c === maxCount);
    if (winners.length !== 1) continue;

    result[winners[0][0]].push(post);
  }

  return result;
}
