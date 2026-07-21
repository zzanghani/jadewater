-- ============================================================================
-- 매장(지점) 분리 마이그레이션
-- 이미 schema.sql을 실행한 기존 프로젝트에 SQL Editor에서 실행하세요.
-- daily_closings / sales / receipts / payment_requests 테이블이 비어 있어야
-- 안전하게 실행됩니다(NOT NULL 컬럼 추가 때문). 데이터가 이미 있다면 먼저
-- 백필(backfill)이 필요하니 실행 전에 말씀해 주세요.
-- ============================================================================

-- --------------------------------------------------------------------------
-- stores: 매장(지점) 테이블 생성 + 4개 매장 시드
-- --------------------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.stores add column if not exists sort_order integer not null default 0;

alter table public.stores enable row level security;

drop policy if exists "stores_select_authenticated" on public.stores;
create policy "stores_select_authenticated"
  on public.stores for select
  to authenticated
  using (true);

-- sort_order가 가장 작은 매장이 기본 선택 매장이 된다 (lib/store.ts 참고)
insert into public.stores (name, sort_order)
values
  ('제이드앤워터 옥수본점', 1),
  ('제이드앤워터 서울역점', 2),
  ('제이드앤워터 성수LCDC', 3),
  ('제이드앤워터 스타필드하남', 4)
on conflict (name) do update set sort_order = excluded.sort_order;

-- --------------------------------------------------------------------------
-- daily_closings: store_id 추가 + unique(date) -> unique(date, store_id)
-- --------------------------------------------------------------------------
alter table public.daily_closings
  add column if not exists store_id uuid references public.stores (id);

alter table public.daily_closings drop constraint if exists daily_closings_date_key;
alter table public.daily_closings alter column store_id set not null;
alter table public.daily_closings drop constraint if exists daily_closings_date_store_id_key;
alter table public.daily_closings add constraint daily_closings_date_store_id_key unique (date, store_id);

-- --------------------------------------------------------------------------
-- sales: store_id 추가 + unique(date) -> unique(date, store_id)
-- --------------------------------------------------------------------------
alter table public.sales
  add column if not exists store_id uuid references public.stores (id);

alter table public.sales drop constraint if exists sales_date_key;
alter table public.sales alter column store_id set not null;
alter table public.sales drop constraint if exists sales_date_store_id_key;
alter table public.sales add constraint sales_date_store_id_key unique (date, store_id);

-- --------------------------------------------------------------------------
-- receipts: store_id 추가
-- --------------------------------------------------------------------------
alter table public.receipts
  add column if not exists store_id uuid references public.stores (id);

alter table public.receipts alter column store_id set not null;

-- --------------------------------------------------------------------------
-- payment_requests: store_id 추가
-- --------------------------------------------------------------------------
alter table public.payment_requests
  add column if not exists store_id uuid references public.stores (id);

alter table public.payment_requests alter column store_id set not null;

-- --------------------------------------------------------------------------
-- 인덱스
-- --------------------------------------------------------------------------
create index if not exists daily_closings_store_id_idx on public.daily_closings (store_id);
create index if not exists payment_requests_store_id_idx on public.payment_requests (store_id);
create index if not exists receipts_store_id_idx on public.receipts (store_id);
create index if not exists sales_store_id_idx on public.sales (store_id);
