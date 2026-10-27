-- ============================================================================
-- 검색 노출 추적: 매장별 추적 키워드로 네이버 지도(지역검색 상위 5)·블로그(상위 30) 노출을 매일 확인한다.
-- - store_search_settings : 매장 식별어(terms, 우리 글/우리 가게 판별용)와 추적 키워드(keywords, 최대 10개)
-- - search_rank_daily     : 날짜·키워드별 지도 순위(1~5, 밖이면 null)·블로그 상위30 중 우리 글 수
-- 여러 번 실행해도 안전합니다.
-- ============================================================================
create table if not exists public.store_search_settings (
  store_id uuid primary key references public.stores (id) on delete cascade,
  terms text[] not null default '{}',
  keywords text[] not null default '{}',
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
alter table public.store_search_settings enable row level security;
drop policy if exists "store_search_settings_select" on public.store_search_settings;
drop policy if exists "store_search_settings_insert" on public.store_search_settings;
drop policy if exists "store_search_settings_update" on public.store_search_settings;
create policy "store_search_settings_select" on public.store_search_settings for select to authenticated using (public.user_is_store_manager(store_id));
create policy "store_search_settings_insert" on public.store_search_settings for insert to authenticated with check (public.user_is_store_manager(store_id));
create policy "store_search_settings_update" on public.store_search_settings for update to authenticated using (public.user_is_store_manager(store_id)) with check (public.user_is_store_manager(store_id));

create table if not exists public.search_rank_daily (
  store_id uuid not null references public.stores (id) on delete cascade,
  date date not null,
  keyword text not null,
  map_rank smallint,
  blog_hits smallint not null default 0,
  checked_at timestamptz not null default now(),
  primary key (store_id, date, keyword)
);
alter table public.search_rank_daily enable row level security;
drop policy if exists "search_rank_daily_select" on public.search_rank_daily;
create policy "search_rank_daily_select" on public.search_rank_daily for select to authenticated using (public.user_is_store_manager(store_id));
