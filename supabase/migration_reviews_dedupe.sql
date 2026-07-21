-- ============================================================================
-- reviews 테이블에 원본 리뷰 ID 컬럼 추가 (중복 수집 방지용)
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 자동수집이 매일 같은 리뷰를 다시 가져올 수 있는데(구글 API가 "최신 5개"가
-- 아니라 "관련도 높은 5개"를 주기 때문), 이 컬럼으로 중복 삽입을 막습니다.
-- ============================================================================

alter table public.reviews
  add column if not exists source_review_id text;

create unique index if not exists reviews_store_platform_source_idx
  on public.reviews (store_id, platform, source_review_id)
  where source_review_id is not null;
