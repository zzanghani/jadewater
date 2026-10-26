-- ============================================================================
-- 토스플레이스 Open API 연결.
-- - toss_settings      : 개발자센터 앱(제이드앤워터 매장관리)의 Access Key / Secret 한 벌. 본사 마스터만.
-- - store_toss_merchants: 매장 ↔ 토스 가맹점 ID(merchantId). 테스트 가맹점도 여기에 둔다.
-- 크론·서버 작업은 서비스 키로 읽는다. 여러 번 실행해도 안전합니다.
-- ============================================================================

create table if not exists public.toss_settings (
  id integer primary key default 1 check (id = 1),
  access_key text not null,
  access_secret text not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
alter table public.toss_settings enable row level security;
create policy "toss_settings_select_hq" on public.toss_settings for select to authenticated using (public.user_is_hq_master());
create policy "toss_settings_insert_hq" on public.toss_settings for insert to authenticated with check (public.user_is_hq_master());
create policy "toss_settings_update_hq" on public.toss_settings for update to authenticated using (public.user_is_hq_master()) with check (public.user_is_hq_master());
create policy "toss_settings_delete_hq" on public.toss_settings for delete to authenticated using (public.user_is_hq_master());

create table if not exists public.store_toss_merchants (
  store_id uuid primary key references public.stores (id) on delete cascade,
  merchant_id text not null,
  merchant_name text,
  is_test boolean not null default false,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
alter table public.store_toss_merchants enable row level security;
create policy "store_toss_merchants_select" on public.store_toss_merchants for select to authenticated using (public.user_is_store_manager(store_id));
create policy "store_toss_merchants_insert_hq" on public.store_toss_merchants for insert to authenticated with check (public.user_is_hq_master());
create policy "store_toss_merchants_update_hq" on public.store_toss_merchants for update to authenticated using (public.user_is_hq_master()) with check (public.user_is_hq_master());
create policy "store_toss_merchants_delete_hq" on public.store_toss_merchants for delete to authenticated using (public.user_is_hq_master());
