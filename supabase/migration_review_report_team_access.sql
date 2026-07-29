-- ============================================================================
-- 리뷰 리포트를 본사 팀 계정(마케팅/R&D 등)에도 마스터 계정과 동일하게
-- 전 매장 노출하도록 변경
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- migration_team_accounts.sql에서 review_platform_stats/reviews/
-- review_ai_summaries/blog_posts 4개 테이블을 user_can_access_store_ops()로
-- 막아뒀었는데(팀 계정 제외), 이걸 매장 운영/재무 테이블과 분리해서
-- user_can_access_store()로 되돌린다. user_can_access_store()는
-- profiles.store_id가 NULL이면(마스터 + 팀 계정 전부) 전 매장 통과,
-- 값이 있으면 해당 매장만 통과한다.
-- ============================================================================

drop policy if exists "review_platform_stats_select_authenticated" on public.review_platform_stats;
create policy "review_platform_stats_select_authenticated"
  on public.review_platform_stats for select
  to authenticated
  using (public.user_can_access_store(store_id));

drop policy if exists "reviews_select_authenticated" on public.reviews;
create policy "reviews_select_authenticated"
  on public.reviews for select
  to authenticated
  using (public.user_can_access_store(store_id));

drop policy if exists "review_ai_summaries_select_authenticated" on public.review_ai_summaries;
create policy "review_ai_summaries_select_authenticated"
  on public.review_ai_summaries for select
  to authenticated
  using (public.user_can_access_store(store_id));

drop policy if exists "blog_posts_select_authenticated" on public.blog_posts;
create policy "blog_posts_select_authenticated"
  on public.blog_posts for select
  to authenticated
  using (public.user_can_access_store(store_id));
