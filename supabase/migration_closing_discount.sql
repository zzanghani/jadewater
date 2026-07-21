-- ============================================================================
-- 일 마감 입력에 할인금액 컬럼 추가
-- SQL Editor에서 실행하세요.
-- ============================================================================

alter table public.daily_closings
  add column if not exists discount_amount numeric(12, 0) not null default 0;
