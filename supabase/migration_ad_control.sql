-- ============================================================================
-- 광고 운영(3순위): 캠페인 조작 이력 · 손익분기(원가율) · 날씨 · 특이일
-- - ad_store_settings : 매장별 원가율 (광고 손익분기 계산용)
-- - weather_daily     : 서울 일별 강수량·기온 (open-meteo, 키 불필요) — 전 매장 공용
-- - ad_special_days   : 매장별 특이일(행사·휴무 등) — 비교에서 제외
-- - ad_change_logs    : 앱에서 바꾼 캠페인 ON/OFF·하루 예산 기록 (효과 판정의 기준점)
-- 여러 번 실행해도 안전합니다.
-- ============================================================================

create table if not exists public.ad_store_settings (
  store_id uuid primary key references public.stores (id) on delete cascade,
  cost_rate numeric not null default 0.35 check (cost_rate >= 0 and cost_rate < 1),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
alter table public.ad_store_settings enable row level security;
drop policy if exists "ad_store_settings_select" on public.ad_store_settings;
drop policy if exists "ad_store_settings_insert" on public.ad_store_settings;
drop policy if exists "ad_store_settings_update" on public.ad_store_settings;
create policy "ad_store_settings_select" on public.ad_store_settings for select to authenticated using (public.user_is_store_manager(store_id));
create policy "ad_store_settings_insert" on public.ad_store_settings for insert to authenticated with check (public.user_is_store_manager(store_id));
create policy "ad_store_settings_update" on public.ad_store_settings for update to authenticated using (public.user_is_store_manager(store_id)) with check (public.user_is_store_manager(store_id));

create table if not exists public.weather_daily (
  date date primary key,
  precip_mm numeric not null default 0,
  tmax numeric,
  tmin numeric,
  synced_at timestamptz not null default now()
);
alter table public.weather_daily enable row level security;
drop policy if exists "weather_daily_select" on public.weather_daily;
create policy "weather_daily_select" on public.weather_daily for select to authenticated using (true);

create table if not exists public.ad_special_days (
  store_id uuid not null references public.stores (id) on delete cascade,
  date date not null,
  note text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (store_id, date)
);
alter table public.ad_special_days enable row level security;
drop policy if exists "ad_special_days_select" on public.ad_special_days;
drop policy if exists "ad_special_days_insert" on public.ad_special_days;
drop policy if exists "ad_special_days_delete" on public.ad_special_days;
create policy "ad_special_days_select" on public.ad_special_days for select to authenticated using (public.user_is_store_manager(store_id));
create policy "ad_special_days_insert" on public.ad_special_days for insert to authenticated with check (public.user_is_store_manager(store_id));
create policy "ad_special_days_delete" on public.ad_special_days for delete to authenticated using (public.user_is_store_manager(store_id));

create table if not exists public.ad_change_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid references public.profiles (id),
  user_name text,
  target_type text not null default 'campaign',
  target_id text not null,
  target_name text,
  field text not null,
  before_value text,
  after_value text,
  created_at timestamptz not null default now()
);
alter table public.ad_change_logs enable row level security;
drop policy if exists "ad_change_logs_select" on public.ad_change_logs;
create policy "ad_change_logs_select" on public.ad_change_logs for select to authenticated using (public.user_is_store_manager(store_id));
create index if not exists ad_change_logs_store_idx on public.ad_change_logs (store_id, created_at desc);
