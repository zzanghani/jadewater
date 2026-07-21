-- ============================================================================
-- reviews 테이블에 원본 리뷰 ID 컬럼 추가 (중복 수집 방지용)
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 자동수집이 매일 같은 리뷰를 다시 가져올 수 있는데(구글 API가 "최신 5개"가
-- 아니라 "관련도 높은 5개"를 주기 때문), 이 컬럼으로 중복 삽입을 막습니다.
-- ============================================================================

alter table public.reviews
  add column if not exists source_review_id text;

-- 부분 인덱스(where ...)는 upsert의 ON CONFLICT 대상으로 쓸 수 없어서
-- 조건 없는 진짜 unique 제약으로 만든다. NULL끼리는 서로 충돌하지 않으므로
-- source_review_id가 없는 기존 리뷰들은 영향받지 않는다.
drop index if exists public.reviews_store_platform_source_idx;

alter table public.reviews
  drop constraint if exists reviews_store_platform_source_key;

alter table public.reviews
  add constraint reviews_store_platform_source_key
  unique (store_id, platform, source_review_id);
