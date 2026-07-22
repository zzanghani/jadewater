-- ============================================================================
-- 그린(테스트) 환경 전용 — 완전히 새로 만든 Supabase 프로젝트에서
-- SQL Editor에 이 파일 전체를 한 번에 붙여넣고 실행하세요.
--
-- 이 파일은 지금까지 프로덕션(블루)에 순서대로 적용된 schema.sql +
-- 여러 migration_*.sql 파일들을 최신 상태 기준으로 하나로 합친 것입니다.
-- 이미 데이터가 있는 프로덕션 DB에는 절대 실행하지 마세요.
-- ============================================================================


-- ============================================================================
-- 1부: 기본 스키마 (schema.sql)
-- ============================================================================

-- --------------------------------------------------------------------------
-- profiles: auth.users 1:1 확장 (이름, 역할, 매장 접근권한)
-- --------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

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

create or replace function public.user_is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and store_id is null
  );
$$;

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

insert into public.stores (name, sort_order)
values
  ('제이드앤워터 옥수본점', 1),
  ('제이드앤워터 서울역점', 2),
  ('제이드앤워터 성수LCDC', 3),
  ('제이드앤워터 스타필드하남', 4)
on conflict (name) do update set sort_order = excluded.sort_order;

-- 리뷰 자동수집용 플랫폼별 매장 ID (그린에서도 동일한 실제 매장 리뷰를 수집해 테스트하려면 유지)
update public.stores set
  google_place_id = 'ChIJRwdZmgmjfDUREo58YuEpLf8',
  naver_place_id = '1012333241',
  kakao_place_id = '201349608'
where name = '제이드앤워터 옥수본점';

update public.stores set
  google_place_id = 'ChIJyeBUDACjfDURpRRHV-Oajcs',
  naver_place_id = '1701681435',
  kakao_place_id = '1663023691'
where name = '제이드앤워터 서울역점';

update public.stores set
  google_place_id = 'ChIJg9d5SA6lfDURHLofXrJV_SA',
  naver_place_id = '2020121493',
  kakao_place_id = '803375233'
where name = '제이드앤워터 성수LCDC';

update public.stores set
  google_place_id = 'ChIJ2_K4cWqzfDURsi1YFAet1wM',
  naver_place_id = '2049545198',
  kakao_place_id = '532722941'
where name = '제이드앤워터 스타필드하남';

-- --------------------------------------------------------------------------
-- daily_closings: 일 마감 (매장별 날짜당 1건)
-- --------------------------------------------------------------------------
create table if not exists public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  store_id uuid not null references public.stores (id),

  lunch_guests integer not null default 0,
  dinner_guests integer not null default 0,
  total_guests integer generated always as (lunch_guests + dinner_guests) stored,

  card_sales numeric(12, 0) not null default 0,
  cash_sales numeric(12, 0) not null default 0,
  easypay_sales numeric(12, 0) not null default 0,
  discount_amount numeric(12, 0) not null default 0,
  payment_sales_total numeric(12, 0)
    generated always as (card_sales + cash_sales + easypay_sales) stored,

  food_sales numeric(12, 0) not null default 0,
  beverage_sales numeric(12, 0) not null default 0,
  wine_sales numeric(12, 0) not null default 0,
  rental_sales numeric(12, 0) not null default 0,
  category_sales_total numeric(12, 0)
    generated always as (food_sales + beverage_sales + wine_sales + rental_sales) stored,

  coupang_eats_sales numeric(12, 0) not null default 0,
  baemin_sales numeric(12, 0) not null default 0,
  delivery_sales_total numeric(12, 0)
    generated always as (coupang_eats_sales + baemin_sales) stored,

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
-- payment_requests: 입금요청 (완료 처리는 마스터 계정만 가능)
-- --------------------------------------------------------------------------
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  vendor_name text not null,
  amount numeric(12, 0) not null,
  bank_name text,
  account_number text,
  completed_at timestamptz,
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

create policy "payment_requests_update_authenticated"
  on public.payment_requests for update
  to authenticated
  using (public.user_is_master())
  with check (public.user_is_master());

create index if not exists payment_requests_completed_at_idx on public.payment_requests (completed_at);

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
-- --------------------------------------------------------------------------
create table if not exists public.monthly_settlements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  month date not null,
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
-- 리뷰 리포트: 플랫폼 통계 / 개별 리뷰 / AI 요약
-- --------------------------------------------------------------------------
create table if not exists public.review_platform_stats (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  date date not null,
  platform text not null check (platform in ('네이버', '카카오맵', '구글')),
  rating numeric(2, 1) not null default 0,
  review_count integer not null default 0,
  change_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, date, platform)
);

alter table public.review_platform_stats enable row level security;

create policy "review_platform_stats_select_authenticated"
  on public.review_platform_stats for select
  to authenticated
  using (public.user_can_access_store(store_id));

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  date date not null,
  platform text not null check (platform in ('네이버', '카카오맵', '구글')),
  rating integer not null check (rating between 1 and 5),
  body text not null,
  source_review_id text,
  created_at timestamptz not null default now(),
  constraint reviews_store_platform_source_key unique (store_id, platform, source_review_id)
);

alter table public.reviews enable row level security;

create policy "reviews_select_authenticated"
  on public.reviews for select
  to authenticated
  using (public.user_can_access_store(store_id));

create table if not exists public.review_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  date date not null,
  summary text not null default '',
  created_at timestamptz not null default now(),
  unique (store_id, date)
);

alter table public.review_ai_summaries enable row level security;

create policy "review_ai_summaries_select_authenticated"
  on public.review_ai_summaries for select
  to authenticated
  using (public.user_can_access_store(store_id));

create index if not exists review_platform_stats_date_idx on public.review_platform_stats (date desc);
create index if not exists review_platform_stats_store_id_idx on public.review_platform_stats (store_id);
create index if not exists reviews_date_idx on public.reviews (date desc);
create index if not exists reviews_store_id_idx on public.reviews (store_id);
create index if not exists review_ai_summaries_date_idx on public.review_ai_summaries (date desc);
create index if not exists review_ai_summaries_store_id_idx on public.review_ai_summaries (store_id);

-- --------------------------------------------------------------------------
-- 네이버 블로그 후기
-- --------------------------------------------------------------------------
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  date date not null,
  posted_at date,
  title text not null,
  body text,
  blogger_name text,
  url text not null,
  created_at timestamptz not null default now(),
  unique (store_id, url)
);

alter table public.blog_posts enable row level security;

create policy "blog_posts_select_authenticated"
  on public.blog_posts for select
  to authenticated
  using (public.user_can_access_store(store_id));

create index if not exists blog_posts_date_idx on public.blog_posts (date desc);
create index if not exists blog_posts_store_id_idx on public.blog_posts (store_id);

-- --------------------------------------------------------------------------
-- 현장지출 (영수증 촬영 기반 지출 등록) + 영수증 사진 저장소
-- --------------------------------------------------------------------------
create table if not exists public.field_expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  date date not null,
  category text not null check (
    category in ('식자재', '소모품', '유류비', '복리후생', '운영', '마케팅', '기타')
  ),
  description text not null,
  amount numeric(12, 0) not null,
  payment_method text not null check (payment_method in ('법인카드', '현금', '자동이체')),
  receipt_photo_path text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.field_expenses enable row level security;

create policy "field_expenses_select_authenticated"
  on public.field_expenses for select
  to authenticated
  using (public.user_can_access_store(store_id));

create policy "field_expenses_insert_authenticated"
  on public.field_expenses for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

create policy "field_expenses_delete_authenticated"
  on public.field_expenses for delete
  to authenticated
  using (public.user_can_access_store(store_id));

create index if not exists field_expenses_date_idx on public.field_expenses (date desc);
create index if not exists field_expenses_store_id_idx on public.field_expenses (store_id);

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and public.user_can_access_store((storage.foldername(name))[1]::uuid)
  );

create policy "receipts_select_authenticated"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and public.user_can_access_store((storage.foldername(name))[1]::uuid)
  );

create policy "receipts_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and public.user_can_access_store((storage.foldername(name))[1]::uuid)
  );

-- --------------------------------------------------------------------------
-- 입금요청 완료 알림 구독 (Web Push)
-- --------------------------------------------------------------------------
-- store_id가 NULL이면 마스터 계정의 구독(모든 매장의 새 요청 알림용)이다.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid references public.stores (id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_authenticated"
  on public.push_subscriptions for select
  to authenticated
  using (store_id is null or public.user_can_access_store(store_id));

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id and public.user_can_access_store(store_id));

-- endpoint가 unique라서 같은 기기가 다른 계정으로 재구독하면 upsert가
-- update로 처리된다. using(true)로 기존 소유자와 무관하게 재등록을 허용하고,
-- with check로 결과가 항상 "로그인한 본인 + 접근 가능한 매장"이 되도록 제한한다.
create policy "push_subscriptions_update_authenticated"
  on public.push_subscriptions for update
  to authenticated
  using (true)
  with check (auth.uid() = user_id and public.user_can_access_store(store_id));

create policy "push_subscriptions_delete_authenticated"
  on public.push_subscriptions for delete
  to authenticated
  using (store_id is null or public.user_can_access_store(store_id));

create index if not exists push_subscriptions_store_id_idx on public.push_subscriptions (store_id);

-- INSERT ... ON CONFLICT DO UPDATE(upsert)는, 충돌 대상인 기존 행이 현재
-- 사용자에게 SELECT 정책상 보이지 않으면(다른 매장 소유였다면) RLS가 충돌
-- 해소를 막아버린다. 그래서 기기 재구독은 테이블 RLS를 우회하는 SECURITY
-- DEFINER 함수로 감싸고, 인증/매장 접근 권한 검사는 함수 안에서 직접 한다.
create or replace function public.upsert_push_subscription(
  p_store_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.user_can_access_store(p_store_id) then
    raise exception 'access denied for store';
  end if;

  insert into public.push_subscriptions (user_id, store_id, endpoint, p256dh, auth)
  values (auth.uid(), p_store_id, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        store_id = excluded.store_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth;
end;
$$;

grant execute on function public.upsert_push_subscription(uuid, text, text, text) to authenticated;

-- --------------------------------------------------------------------------
-- 사내 게시판(미니 슬랙): 게시글 + 댓글(1단계 스레드) + 파일/사진 첨부
-- 매장 간 소통용이라 매장 접근제어 없이 로그인한 모든 사용자에게 공개된다.
-- --------------------------------------------------------------------------
-- Follower는 여러 명일 수 있어서 board_posts에는 컬럼을 두지 않고 별도
-- board_post_followers 테이블로 다대다 관계를 표현한다(아래 참고).
-- Order(작성자)가 확인하고 Follower 전원이 확인하면 completed_at이 채워져
-- 목록에서 사라진다 (payment_requests의 completed_at 패턴과 동일).
create table if not exists public.board_posts (
  id uuid primary key default gen_random_uuid(),
  category text not null default '운영HR' check (category in ('공지사항', '마케팅', '운영HR', '디자인', 'R&D')),
  title text not null,
  body text not null,
  created_by uuid not null references public.profiles (id),
  requester_confirmed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.board_posts enable row level security;

create policy "board_posts_select_authenticated"
  on public.board_posts for select
  to authenticated
  using (true);

create policy "board_posts_insert_own"
  on public.board_posts for insert
  to authenticated
  with check (auth.uid() = created_by);

-- 작성자 본인만 자신의 확인(requester_confirmed) 체크를 업데이트할 수 있다.
create policy "board_posts_update_own"
  on public.board_posts for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "board_posts_delete_own"
  on public.board_posts for delete
  to authenticated
  using (auth.uid() = created_by);

create index if not exists board_posts_created_at_idx on public.board_posts (created_at desc);
create index if not exists board_posts_completed_at_idx on public.board_posts (completed_at);
create index if not exists board_posts_category_idx on public.board_posts (category);

create table if not exists public.board_post_followers (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.board_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.board_post_followers enable row level security;

create policy "board_post_followers_select_authenticated"
  on public.board_post_followers for select
  to authenticated
  using (true);

-- Follower 추가는 그 글의 작성자만 할 수 있다 (글쓸 때 지정).
create policy "board_post_followers_insert_by_post_owner"
  on public.board_post_followers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.board_posts
      where id = post_id and created_by = auth.uid()
    )
  );

-- 본인의 확인 체크는 본인만 업데이트할 수 있다.
create policy "board_post_followers_update_own"
  on public.board_post_followers for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists board_post_followers_post_id_idx on public.board_post_followers (post_id);
create index if not exists board_post_followers_user_id_idx on public.board_post_followers (user_id);

create table if not exists public.board_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.board_posts (id) on delete cascade,
  body text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.board_comments enable row level security;

create policy "board_comments_select_authenticated"
  on public.board_comments for select
  to authenticated
  using (true);

create policy "board_comments_insert_own"
  on public.board_comments for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "board_comments_delete_own"
  on public.board_comments for delete
  to authenticated
  using (auth.uid() = created_by);

create index if not exists board_comments_post_id_idx on public.board_comments (post_id, created_at);

-- 첨부파일은 게시글 또는 댓글 중 정확히 하나에만 달린다.
create table if not exists public.board_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.board_posts (id) on delete cascade,
  comment_id uuid references public.board_comments (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint board_attachments_target_check check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  )
);

alter table public.board_attachments enable row level security;

create policy "board_attachments_select_authenticated"
  on public.board_attachments for select
  to authenticated
  using (true);

create policy "board_attachments_insert_own"
  on public.board_attachments for insert
  to authenticated
  with check (auth.uid() = created_by);

create index if not exists board_attachments_post_id_idx on public.board_attachments (post_id);
create index if not exists board_attachments_comment_id_idx on public.board_attachments (comment_id);

insert into storage.buckets (id, name, public)
values ('board', 'board', false)
on conflict (id) do nothing;

create policy "board_files_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'board');

create policy "board_files_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'board');

-- 댓글이 달리면 게시글 작성자에게 push 알림을 보내야 하는데, 작성자가
-- 다른 매장 소속이면 push_subscriptions SELECT 정책(매장 접근제어)에
-- 막혀서 댓글 단 사람이 그 구독 목록을 읽을 수 없다. 그래서 대상 user_id의
-- 구독만 반환하는 SECURITY DEFINER 함수로 우회한다.
create or replace function public.get_push_subscriptions_for_user(p_user_id uuid)
returns setof public.push_subscriptions
language sql
security definer
set search_path = public
as $$
  select * from public.push_subscriptions where user_id = p_user_id;
$$;

grant execute on function public.get_push_subscriptions_for_user(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- 인덱스 (기본 테이블)
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

-- ============================================================================
-- 여기까지 실행하면 스키마 준비 완료.
-- 다음 순서: Authentication에서 계정 5개(마스터 1 + 지점 4) 생성 →
-- link_store_accounts.sql로 지점 계정을 매장에 연결.
-- ============================================================================
