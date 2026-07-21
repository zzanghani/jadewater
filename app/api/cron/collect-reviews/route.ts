import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchGooglePlaceSnapshot } from "@/lib/googlePlaces";
import { fetchNaverBlogPosts, filterPostsForStore } from "@/lib/naverBlog";
import { kstDateString } from "@/lib/date";

// Vercel Cron이 매일 KST 06:00에 호출한다 (vercel.json 참고).
// CRON_SECRET이 설정되어 있으면 Vercel이 Authorization 헤더에 자동으로 실어 보낸다.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY not set" }, { status: 500 });
  }

  const naverClientId = process.env.NAVER_CLIENT_ID;
  const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

  const supabase = createServiceClient();
  const today = kstDateString(0);
  const yesterday = kstDateString(1);

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("id, name, google_place_id");

  if (storesError) {
    return NextResponse.json({ error: storesError.message }, { status: 500 });
  }

  const results: Record<string, string> = {};

  for (const store of stores ?? []) {
    if (!store.google_place_id) {
      results[store.name] = "건너뜀: google_place_id 없음";
      continue;
    }

    const snapshot = await fetchGooglePlaceSnapshot(store.google_place_id, apiKey);
    if (!snapshot) {
      results[store.name] = "수집 실패 (Google API 응답 오류)";
      continue;
    }

    const { data: yesterdayStat } = await supabase
      .from("review_platform_stats")
      .select("review_count")
      .eq("store_id", store.id)
      .eq("date", yesterday)
      .eq("platform", "구글")
      .maybeSingle();

    const changeCount = yesterdayStat
      ? snapshot.reviewCount - yesterdayStat.review_count
      : 0;

    await supabase.from("review_platform_stats").upsert(
      {
        store_id: store.id,
        date: today,
        platform: "구글",
        rating: snapshot.rating,
        review_count: snapshot.reviewCount,
        change_count: changeCount,
      },
      { onConflict: "store_id,date,platform" }
    );

    let reviewsError: string | null = null;
    if (snapshot.reviews.length > 0) {
      const { error } = await supabase.from("reviews").upsert(
        snapshot.reviews.map((r) => ({
          store_id: store.id,
          date: today,
          platform: "구글" as const,
          rating: r.rating,
          body: r.body,
          source_review_id: r.sourceId,
        })),
        { onConflict: "store_id,platform,source_review_id", ignoreDuplicates: true }
      );
      reviewsError = error?.message ?? null;
    }

    let blogSummary = "";
    if (naverClientId && naverClientSecret) {
      const rawPosts = await fetchNaverBlogPosts(store.name, naverClientId, naverClientSecret);
      const posts = filterPostsForStore(rawPosts, store.name);
      if (posts.length > 0) {
        const { error: blogError, count } = await supabase.from("blog_posts").upsert(
          posts.map((p) => ({
            store_id: store.id,
            date: today,
            posted_at: p.postedAt,
            title: p.title,
            body: p.body,
            blogger_name: p.bloggerName,
            url: p.url,
          })),
          { onConflict: "store_id,url", ignoreDuplicates: true, count: "exact" }
        );
        blogSummary = blogError
          ? `, 블로그 저장 오류: ${blogError.message}`
          : `, 블로그 신규 ${count ?? posts.length}건`;
      }
    }

    results[store.name] = reviewsError
      ? `완료 (평점 ${snapshot.rating}, 총 ${snapshot.reviewCount}건) — 리뷰 저장 오류: ${reviewsError}${blogSummary}`
      : `완료 (평점 ${snapshot.rating}, 총 ${snapshot.reviewCount}건, 증가 ${changeCount}건${blogSummary})`;
  }

  return NextResponse.json({ ok: true, date: today, results });
}
