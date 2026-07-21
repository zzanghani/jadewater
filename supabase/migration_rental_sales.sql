-- ============================================================================
-- 일 마감 카테고리에 대관매출 추가
-- SQL Editor에서 실행하세요.
-- ============================================================================

alter table public.daily_closings
  add column if not exists rental_sales numeric(12, 0) not null default 0;

alter table public.daily_closings drop column if exists category_sales_total;
alter table public.daily_closings add column category_sales_total numeric(12, 0)
  generated always as (food_sales + beverage_sales + wine_sales + rental_sales) stored;
