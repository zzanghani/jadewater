import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchGooglePlaceSnapshot } from "@/lib/googlePlaces";
import { classifyPostsByStore, fetchNaverBlogPosts, type NaverBlogPost } from "@/lib/naverBlog";
import { generateReviewSummary } from "@/lib/claude";
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

  const [{ data: stores, error: storesError }, { data: brands, error: brandsError }] =
    await Promise.all([
      supabase.from("stores").select("id, name, brand_id, blog_keywords, google_place_id"),
      supabase.from("brands").select("id, name, review_keyword, blog_match_token"),
    ]);

  if (storesError || brandsError) {
    return NextResponse.json(
      { error: storesError?.message ?? brandsError?.message },
      { status: 500 }
    );
  }

  const results: Record<string, string> = {};

  // 매장별로 따로 검색하는 대신 브랜드명("제이드앤워터" / "정다미")으로 한 번에
  // 넓게 검색한 뒤, 글마다 어느 지점 얘기가 가장 많이 나오는지로 분류한다.
  // (매장별 검색은 결과 개수 제한 때문에 누락이 많았다.)
  //
  // 브랜드별로 따로 검색하고 그 브랜드의 매장 안에서만 분류하는 게 중요하다.
  // 제이드앤워터 서울역점과 정다미 서울역점처럼 지역 키워드가 겹치는 매장이
  // 다른 브랜드에 있으면, 한 번에 섞어서 분류할 경우 서로 남의 글을 가져간다.
  //
  // 네이버 검색은 관련도순(sort=sim)이라 몇 달 전 글이 오늘 처음 100위 안에
  // 잡히는 경우가 있는데, 그러면 실제로는 오래된 글인데도 "오늘 새로 발견"으로
  // 저장돼서 리포트에 "새로 달린 후기"처럼 보이는 문제가 있었다. 그래서 실제
  // 작성일(postedAt)이 최근 7일 이내인 글만 저장 대상으로 남긴다.
  const sevenDaysAgo = kstDateString(7);
  const postsByStore: Record<string, NaverBlogPost[]> = {};
  if (naverClientId && naverClientSecret) {
    for (const brand of brands ?? []) {
      if (!brand.review_keyword) continue;
      const brandStores = (stores ?? []).filter((s) => s.brand_id === brand.id);
      if (brandStores.length === 0) continue;

      const allPosts = await fetchNaverBlogPosts(
        brand.review_keyword,
        naverClientId,
        naverClientSecret
      );
      const recentPosts = allPosts.filter((p) => p.postedAt >= sevenDaysAgo);
      Object.assign(
        postsByStore,
        classifyPostsByStore(recentPosts, brand.blog_match_token, brandStores)
      );
    }
  }

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
    {
      const posts = postsByStore[store.id] ?? [];
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

    // 이번 실행에서 실제로 새로 저장된(=오늘 날짜로 처음 insert된) 리뷰/블로그만
    // AI 요약 대상으로 삼는다. upsert 시 중복은 ON CONFLICT DO NOTHING이라
    // 기존 행의 date는 갱신되지 않으므로, date=today로 조회하면 신규 항목만 잡힌다.
    const claudeApiKey = process.env.ANTHROPIC_API_KEY;
    const [{ data: todaysReviews }, { data: todaysBlogPosts }, { data: todaysPlatformStats }] =
      await Promise.all([
        supabase
          .from("reviews")
          .select("platform, rating, body")
          .eq("store_id", store.id)
          .eq("date", today),
        supabase
          .from("blog_posts")
          .select("title, body")
          .eq("store_id", store.id)
          .eq("date", today),
        supabase
          .from("review_platform_stats")
          .select("platform, rating, review_count, change_count")
          .eq("store_id", store.id)
          .eq("date", today),
      ]);

    let summarySuffix: string;
    if (!claudeApiKey) {
      summarySuffix = ", AI요약: 건너뜀(ANTHROPIC_API_KEY 없음)";
    } else if ((todaysReviews?.length ?? 0) === 0 && (todaysBlogPosts?.length ?? 0) === 0) {
      summarySuffix = ", AI요약: 건너뜀(신규 데이터 없음)";
    } else {
      const summary = await generateReviewSummary(
        {
          storeName: store.name,
          platforms: (todaysPlatformStats ?? []).map((p) => ({
            name: p.platform,
            rating: p.rating,
            count: p.review_count,
            change: p.change_count,
          })),
          newReviews: (todaysReviews ?? []).map((r) => ({
            platform: r.platform,
            rating: r.rating,
            body: r.body,
          })),
          blogPosts: (todaysBlogPosts ?? []).map((p) => ({ title: p.title, body: p.body })),
        },
        claudeApiKey
      );

      if (!summary) {
        summarySuffix = ", AI요약: 생성 실패";
      } else {
        const { error: summaryError } = await supabase.from("review_ai_summaries").upsert(
          { store_id: store.id, date: today, summary },
          { onConflict: "store_id,date" }
        );
        summarySuffix = summaryError
          ? `, AI요약 저장 오류: ${summaryError.message}`
          : ", AI요약: 생성완료";
      }
    }

    results[store.name] = reviewsError
      ? `완료 (평점 ${snapshot.rating}, 총 ${snapshot.reviewCount}건) — 리뷰 저장 오류: ${reviewsError}${blogSummary}${summarySuffix}`
      : `완료 (평점 ${snapshot.rating}, 총 ${snapshot.reviewCount}건, 증가 ${changeCount}건${blogSummary})${summarySuffix}`;
  }

  return NextResponse.json({ ok: true, date: today, results });
}
