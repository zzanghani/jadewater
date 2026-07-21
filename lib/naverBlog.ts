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

// 네이버 검색 API(블로그)로 매장명을 검색해 최신 블로그 글을 가져온다.
// https://developers.naver.com/docs/serviceapi/search/blog/blog.md
export async function fetchNaverBlogPosts(
  query: string,
  clientId: string,
  clientSecret: string,
  display = 5
): Promise<NaverBlogPost[]> {
  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(
    query
  )}&display=${display}&sort=date`;

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

// 지점별 지역 키워드. "옥수" 매장을 검색했는데 제목에 "하남"이 크게 들어간
// (다른 지점 얘기인) 글이 섞여 들어오는 걸 걸러내는 데 쓴다.
const BRANCH_KEYWORDS: [string, string[]][] = [
  ["옥수", ["옥수"]],
  ["서울역", ["서울역"]],
  ["성수", ["성수"]],
  ["하남", ["하남", "스타필드"]],
];

// storeName에 해당하는 지점 키워드가 아닌, 다른 지점 키워드가 제목에 있으면 걸러낸다.
export function filterPostsForStore(posts: NaverBlogPost[], storeName: string): NaverBlogPost[] {
  const ownBranch = BRANCH_KEYWORDS.find(([key]) => storeName.includes(key))?.[0];

  return posts.filter((post) => {
    for (const [branch, keywords] of BRANCH_KEYWORDS) {
      if (branch === ownBranch) continue;
      if (keywords.some((k) => post.title.includes(k))) {
        return false;
      }
    }
    return true;
  });
}
