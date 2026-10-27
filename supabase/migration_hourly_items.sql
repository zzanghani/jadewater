-- ============================================================================
-- 시간·요일 분석과 메뉴 판매 비교의 재료.
-- - ad_hourly_stats  : 매장·날짜·시간대별 네이버 광고 노출·클릭·광고비·전환 (stats breakdown=hh24)
-- - toss_daily_items : 매장·날짜·메뉴별 판매 수량·금액 (토스 주문 lineItems)
-- 쓰기는 서비스 키, 읽기는 지점장·마스터. 여러 번 실행해도 안전합니다.
-- ============================================================================
create table if not exists public.ad_hourly_stats (
  store_id uuid not null references public.stores (id) on delete cascade,
  date date not null,
  hour smallint not null check (hour between 0 and 23),
  imp integer not null default 0,
  clk integer not null default 0,
  cost integer not null default 0,
  conv integer not null default 0,
  synced_at timestamptz not null default now(),
  primary key (store_id, date, hour)
);
alter table public.ad_hourly_stats enable row level security;
drop policy if exists "ad_hourly_stats_select" on public.ad_hourly_stats;
create policy "ad_hourly_stats_select" on public.ad_hourly_stats for select to authenticated using (public.user_is_store_manager(store_id));

create table if not exists public.toss_daily_items (
  store_id uuid not null references public.stores (id) on delete cascade,
  date date not null,
  name text not null,
  category text not null default '',
  qty integer not null default 0,
  amount integer not null default 0,
  orders integer not null default 0,
  synced_at timestamptz not null default now(),
  primary key (store_id, date, name)
);
alter table public.toss_daily_items enable row level security;
drop policy if exists "toss_daily_items_select" on public.toss_daily_items;
create policy "toss_daily_items_select" on public.toss_daily_items for select to authenticated using (public.user_is_store_manager(store_id));
create index if not exists toss_daily_items_store_date_idx on public.toss_daily_items (store_id, date);
