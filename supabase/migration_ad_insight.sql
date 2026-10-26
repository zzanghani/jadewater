-- ============================================================================
-- 광고 효율 분석: 토스 일매출 + 네이버 일별 광고 성과를 날짜별로 쌓아 둔다.
-- - toss_daily_sales : 매장·날짜별 토스 결제 집계 (마감 자료와 같은 기준)
-- - ad_daily_stats   : 매장·날짜별 네이버 검색광고 노출·클릭·광고비·전환
-- - ad_insight_memos : AI가 쓴 전략 메모(매장·날짜별 캐시)
-- 쓰기는 서비스 키(동기화 액션·크론)만, 읽기는 지점장·마스터. 여러 번 실행해도 안전합니다.
-- ============================================================================

create table if not exists public.toss_daily_sales (
  store_id uuid not null references public.stores (id) on delete cascade,
  date date not null,
  sales integer not null default 0,
  orders integer not null default 0,
  card integer not null default 0,
  cash integer not null default 0,
  easypay integer not null default 0,
  external integer not null default 0,
  delivery integer not null default 0,
  discount integer not null default 0,
  by_hour jsonb,
  synced_at timestamptz not null default now(),
  primary key (store_id, date)
);
alter table public.toss_daily_sales enable row level security;
create policy "toss_daily_sales_select" on public.toss_daily_sales for select to authenticated using (public.user_is_store_manager(store_id));

create table if not exists public.ad_daily_stats (
  store_id uuid not null references public.stores (id) on delete cascade,
  date date not null,
  imp integer not null default 0,
  clk integer not null default 0,
  cost integer not null default 0,
  conv integer not null default 0,
  synced_at timestamptz not null default now(),
  primary key (store_id, date)
);
alter table public.ad_daily_stats enable row level security;
create policy "ad_daily_stats_select" on public.ad_daily_stats for select to authenticated using (public.user_is_store_manager(store_id));

create table if not exists public.ad_insight_memos (
  store_id uuid not null references public.stores (id) on delete cascade,
  date date not null,
  memo text not null,
  generated_at timestamptz not null default now(),
  primary key (store_id, date)
);
alter table public.ad_insight_memos enable row level security;
create policy "ad_insight_memos_select" on public.ad_insight_memos for select to authenticated using (public.user_is_store_manager(store_id));
