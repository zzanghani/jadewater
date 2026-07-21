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
