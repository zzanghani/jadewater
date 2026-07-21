-- ============================================================================
-- 매장 정산 웹앱 스키마
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

-- --------------------------------------------------------------------------
-- profiles: auth.users 1:1 확장 (이름, 역할)
-- --------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 로그인한 사람은 누구나 프로필 목록을 볼 수 있음 (작성자 이름 표시용)
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- 본인 프로필만 생성/수정 가능
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- 회원가입 시 auth.users -> profiles 자동 생성 (메타데이터의 name, role 사용)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------------
-- stores: 매장(지점)
-- --------------------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  google_place_id text,
  naver_place_id text,
  kakao_place_id text,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- profiles.store_id: 매장별 접근 제어
-- NULL이면 마스터 계정(전 지점 조회/수정), 값이 있으면 그 매장만 접근 가능.
-- stores 테이블 생성 직후, RLS 정책들이 이 함수를 쓰기 전에 만들어야 한다.
-- --------------------------------------------------------------------------
alter table public.profiles add column if not exists store_id uuid references public.stores (id);

create or replace function public.user_can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (store_id is null or store_id = target_store_id)
  );
$$;

-- 로그인한 사용자가 본인 프로필의 store_id/role을 API로 직접 바꿔
-- 다른 매장에 접근하거나 권한을 올리는 것을 막는다.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.id = auth.uid() then
    new.store_id := old.store_id;
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_escalation on public.profiles;
create trigger profiles_prevent_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

alter table public.stores enable row level security;

create policy "stores_select_authenticated"
  on public.stores for select
  to authenticated
  using (public.user_can_access_store(id));

-- sort_order가 가장 작은 매장이 기본 선택 매장이 된다 (lib/store.ts 참고)
insert into public.stores (name, sort_order)
values
  ('제이드앤워터 옥수본점', 1),
  ('제이드앤워터 서울역점', 2),
  ('제이드앤워터 성수LCDC', 3),
  ('제이드앤워터 스타필드하남', 4)
on conflict (name) do update set sort_order = excluded.sort_order;

-- --------------------------------------------------------------------------
-- daily_closings: 일 마감 (매장별 날짜당 1건)
-- 객수 / 매출(결제수단) / 매출(카테고리) / 배달매출을 각각 기록하고,
-- 소계는 generated column으로 자동 계산한다.
-- --------------------------------------------------------------------------
create table if not exists public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  store_id uuid not null references public.stores (id),

  -- 총객수
  lunch_guests integer not null default 0,
  dinner_guests integer not null default 0,
  total_guests integer generated always as (lunch_guests + dinner_guests) stored,

  -- 총매출 (결제수단별)
  card_sales numeric(12, 0) not null default 0,
  cash_sales numeric(12, 0) not null default 0,
  easypay_sales numeric(12, 0) not null default 0,
  discount_amount numeric(12, 0) not null default 0,
  payment_sales_total numeric(12, 0)
    generated always as (card_sales + cash_sales + easypay_sales) stored,

  -- 카테고리별 매출
  food_sales numeric(12, 0) not null default 0,
  beverage_sales numeric(12, 0) not null default 0,
  wine_sales numeric(12, 0) not null default 0,
  rental_sales numeric(12, 0) not null default 0,
  category_sales_total numeric(12, 0)
    generated always as (food_sales + beverage_sales + wine_sales + rental_sales) stored,

  -- 배달매출
  coupang_eats_sales numeric(12, 0) not null default 0,
  baemin_sales numeric(12, 0) not null default 0,
  delivery_sales_total numeric(12, 0)
    generated always as (coupang_eats_sales + baemin_sales) stored,

  -- 그날의 총매출 = 결제수단 합계 + 배달매출
  grand_total numeric(12, 0)
    generated always as (
      card_sales + cash_sales + easypay_sales + coupang_eats_sales + baemin_sales
    ) stored,

  notes text,
  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, store_id)
);

alter table public.daily_closings enable row level security;

create policy "daily_closings_select_authenticated"
  on public.daily_closings for select
  to authenticated
  using (public.user_can_access_store(store_id));

create policy "daily_closings_insert_authenticated"
  on public.daily_closings for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

create policy "daily_closings_update_authenticated"
  on public.daily_closings for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_closings_set_updated_at on public.daily_closings;
create trigger daily_closings_set_updated_at
  before update on public.daily_closings
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- payment_requests: 입금요청
-- --------------------------------------------------------------------------
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  vendor_name text not null,
  amount numeric(12, 0) not null,
  bank_name text,
  account_number text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.payment_requests enable row level security;

create policy "payment_requests_select_authenticated"
  on public.payment_requests for select
  to authenticated
  using (public.user_can_access_store(store_id));

create policy "payment_requests_insert_authenticated"
  on public.payment_requests for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

create policy "payment_requests_delete_own"
  on public.payment_requests for delete
  to authenticated
  using (public.user_can_access_store(store_id) and auth.uid() = created_by);

-- --------------------------------------------------------------------------
-- receipts: 입고 영수증
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'receipt_category') then
    create type public.receipt_category as enum ('식재료', '음료재료', '소모품', '기타');
  end if;
end
$$;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  store_id uuid not null references public.stores (id),
  supplier text not null,
  items text,
  amount numeric(12, 0) not null,
  category public.receipt_category not null default '기타',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.receipts enable row level security;

create policy "receipts_select_authenticated"
  on public.receipts for select
  to authenticated
  using (public.user_can_access_store(store_id));

create policy "receipts_insert_authenticated"
  on public.receipts for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

create policy "receipts_update_authenticated"
  on public.receipts for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));

create policy "receipts_delete_authenticated"
  on public.receipts for delete
  to authenticated
  using (public.user_can_access_store(store_id));

-- --------------------------------------------------------------------------
-- monthly_settlements: 월말정산 (매장별 월당 1건)
-- 매출/카테고리/거래처는 daily_closings·receipts에서 자동 집계하므로 여기엔
-- 저장하지 않는다. 인건비/공과금/판관비처럼 다달이 항목이 바뀌는 목록은
-- jsonb 배열로 저장한다: [{ "name": "김도형 점장", "amount": 3084654, "note": "" }, ...]
-- --------------------------------------------------------------------------
create table if not exists public.monthly_settlements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  month date not null, -- 해당 월의 1일 (예: 2026-06-01)
  manager_name text,

  labor_items jsonb not null default '[]'::jsonb,
  utility_items jsonb not null default '[]'::jsonb,
  hq_fee_items jsonb not null default '[]'::jsonb,

  pension_reserve numeric(12, 0) not null default 0,
  vat_reserve numeric(12, 0) not null default 0,
  corp_tax_reserve numeric(12, 0) not null default 0,
  reserve_carryover numeric(12, 0) not null default 0,
  reserve_deduction numeric(12, 0) not null default 0,
  discount_amount numeric(12, 0) not null default 0,

  notes text,
  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, month)
);

alter table public.monthly_settlements enable row level security;

create policy "monthly_settlements_select_authenticated"
  on public.monthly_settlements for select
  to authenticated
  using (public.user_can_access_store(store_id));

create policy "monthly_settlements_insert_authenticated"
  on public.monthly_settlements for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

create policy "monthly_settlements_update_authenticated"
  on public.monthly_settlements for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));

drop trigger if exists monthly_settlements_set_updated_at on public.monthly_settlements;
create trigger monthly_settlements_set_updated_at
  before update on public.monthly_settlements
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- 인덱스
-- --------------------------------------------------------------------------
create index if not exists daily_closings_date_idx on public.daily_closings (date desc);
create index if not exists daily_closings_store_id_idx on public.daily_closings (store_id);
create index if not exists payment_requests_created_at_idx on public.payment_requests (created_at desc);
create index if not exists payment_requests_store_id_idx on public.payment_requests (store_id);
create index if not exists receipts_date_idx on public.receipts (date desc);
create index if not exists receipts_category_idx on public.receipts (category);
create index if not exists receipts_store_id_idx on public.receipts (store_id);
create index if not exists monthly_settlements_month_idx on public.monthly_settlements (month desc);
create index if not exists monthly_settlements_store_id_idx on public.monthly_settlements (store_id);
