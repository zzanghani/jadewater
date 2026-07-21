-- ============================================================================
-- 일 마감 입력 재설계 마이그레이션
-- daily_closings의 sales/labor_cost/waste_cost를 없애고
-- 객수(런치/디너), 매출(카드/현금/간편결제), 카테고리(음식/음료/와인),
-- 배달매출(쿠팡이츠/배민)로 교체한다. sales 테이블은 일마감으로 통합되어 삭제된다.
--
-- daily_closings에 이미 데이터가 있다면 이 마이그레이션으로 sales/labor_cost/
-- waste_cost 값이 사라집니다(구조가 완전히 달라져 자동 이관이 불가능합니다).
-- sales 테이블 데이터도 함께 삭제됩니다. 계속 진행해도 괜찮은지 확인 후 실행하세요.
-- ============================================================================

-- --------------------------------------------------------------------------
-- daily_closings: 기존 컬럼 제거
-- --------------------------------------------------------------------------
alter table public.daily_closings drop column if exists sales;
alter table public.daily_closings drop column if exists labor_cost;
alter table public.daily_closings drop column if exists waste_cost;

-- --------------------------------------------------------------------------
-- daily_closings: 새 컬럼 추가
-- --------------------------------------------------------------------------
alter table public.daily_closings add column if not exists lunch_guests integer not null default 0;
alter table public.daily_closings add column if not exists dinner_guests integer not null default 0;
alter table public.daily_closings drop column if exists total_guests;
alter table public.daily_closings add column total_guests integer
  generated always as (lunch_guests + dinner_guests) stored;

alter table public.daily_closings add column if not exists card_sales numeric(12, 0) not null default 0;
alter table public.daily_closings add column if not exists cash_sales numeric(12, 0) not null default 0;
alter table public.daily_closings add column if not exists easypay_sales numeric(12, 0) not null default 0;
alter table public.daily_closings drop column if exists payment_sales_total;
alter table public.daily_closings add column payment_sales_total numeric(12, 0)
  generated always as (card_sales + cash_sales + easypay_sales) stored;

alter table public.daily_closings add column if not exists food_sales numeric(12, 0) not null default 0;
alter table public.daily_closings add column if not exists beverage_sales numeric(12, 0) not null default 0;
alter table public.daily_closings add column if not exists wine_sales numeric(12, 0) not null default 0;
alter table public.daily_closings drop column if exists category_sales_total;
alter table public.daily_closings add column category_sales_total numeric(12, 0)
  generated always as (food_sales + beverage_sales + wine_sales) stored;

alter table public.daily_closings add column if not exists coupang_eats_sales numeric(12, 0) not null default 0;
alter table public.daily_closings add column if not exists baemin_sales numeric(12, 0) not null default 0;
alter table public.daily_closings drop column if exists delivery_sales_total;
alter table public.daily_closings add column delivery_sales_total numeric(12, 0)
  generated always as (coupang_eats_sales + baemin_sales) stored;

alter table public.daily_closings drop column if exists grand_total;
alter table public.daily_closings add column grand_total numeric(12, 0)
  generated always as (
    card_sales + cash_sales + easypay_sales + coupang_eats_sales + baemin_sales
  ) stored;

-- --------------------------------------------------------------------------
-- sales 테이블 삭제 (일마감으로 통합됨)
-- --------------------------------------------------------------------------
drop table if exists public.sales;
