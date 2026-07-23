-- ============================================================================
-- 주간보고 (지점장이 매장별로 주단위 작성)
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 매장당 한 주에 보고서 1건. 지점장(매장 계정)이 작성/수정하고,
-- 마스터는 user_can_access_store가 모든 매장에 대해 true라 조회는
-- 자연스럽게 전 매장이 가능하다 (쓰기는 화면(UI)에서 지점장 계정으로만
-- 제한한다 — 다른 매장/현장지출 화면과 동일한 방식).
-- ============================================================================

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  week_start date not null,

  goals text[] not null default '{}',
  hr_items text[] not null default '{}',
  sales_notes text[] not null default '{}',
  sales_table jsonb not null default '[]',
  issues text[] not null default '{}',
  kitchen_items text[] not null default '{}',
  hall_items text[] not null default '{}',

  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (store_id, week_start)
);

alter table public.weekly_reports enable row level security;

create policy "weekly_reports_select_authenticated"
  on public.weekly_reports for select
  to authenticated
  using (public.user_can_access_store(store_id));

create policy "weekly_reports_insert_authenticated"
  on public.weekly_reports for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

create policy "weekly_reports_update_authenticated"
  on public.weekly_reports for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));

create index if not exists weekly_reports_store_id_idx on public.weekly_reports (store_id);
create index if not exists weekly_reports_week_start_idx on public.weekly_reports (week_start desc);

create or replace function public.weekly_reports_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists weekly_reports_updated_at on public.weekly_reports;
create trigger weekly_reports_updated_at
  before update on public.weekly_reports
  for each row execute function public.weekly_reports_set_updated_at();
