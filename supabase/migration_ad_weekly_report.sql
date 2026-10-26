-- ============================================================================
-- 네이버 검색광고 주간 리포트 (성수LCDC 김도형 점장 인수인계 문서 2026-10-26 기준)
--
-- - store_ad_accounts : 매장별 네이버 검색광고 API 키 + 월 예산·목표 전환당 비용.
--                       본사 마스터만 읽고 쓴다(RLS). 크론은 서비스 키로 읽는다.
-- - ad_weekly_reports : 매장·주 단위 리포트 저장본(JSON). 6시간 캐시용.
-- 여러 번 실행해도 안전합니다.
-- ============================================================================

create table if not exists public.store_ad_accounts (
  store_id uuid primary key references public.stores (id) on delete cascade,
  naver_customer_id text not null,
  naver_api_key text not null,
  naver_secret_key text not null,
  monthly_budget integer,
  target_cpa integer,
  enabled boolean not null default true,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

alter table public.store_ad_accounts enable row level security;

create policy "store_ad_accounts_select_hq" on public.store_ad_accounts
  for select to authenticated using (public.user_is_hq_master());
create policy "store_ad_accounts_insert_hq" on public.store_ad_accounts
  for insert to authenticated with check (public.user_is_hq_master());
create policy "store_ad_accounts_update_hq" on public.store_ad_accounts
  for update to authenticated using (public.user_is_hq_master()) with check (public.user_is_hq_master());
create policy "store_ad_accounts_delete_hq" on public.store_ad_accounts
  for delete to authenticated using (public.user_is_hq_master());

create table if not exists public.ad_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  week_start date not null,
  report jsonb not null,
  generated_at timestamptz not null default now(),
  unique (store_id, week_start)
);

alter table public.ad_weekly_reports enable row level security;

-- 리포트는 그 매장을 볼 수 있는 사람(지점장·마스터)이 읽고, 다시 만들기는 지점장·마스터가 한다.
create policy "ad_weekly_reports_select" on public.ad_weekly_reports
  for select to authenticated using (public.user_is_store_manager(store_id));
create policy "ad_weekly_reports_insert" on public.ad_weekly_reports
  for insert to authenticated with check (public.user_is_store_manager(store_id));
create policy "ad_weekly_reports_update" on public.ad_weekly_reports
  for update to authenticated using (public.user_is_store_manager(store_id)) with check (public.user_is_store_manager(store_id));

-- 지점장이 리포트를 만들 때 자기 매장 키를 읽어야 하지만 키 자체는 화면에 내려보내지 않는다.
-- 키를 노출하지 않고 "연결돼 있는지"만 알려주는 뷰 성격의 함수.
create or replace function public.store_ad_account_status(target_store_id uuid)
returns table (connected boolean, monthly_budget integer, target_cpa integer, naver_customer_id text)
language sql
stable
security definer
set search_path = public
as $$
  select true, a.monthly_budget, a.target_cpa, a.naver_customer_id
  from public.store_ad_accounts a
  where a.store_id = target_store_id and a.enabled
    and public.user_is_store_manager(target_store_id);
$$;
