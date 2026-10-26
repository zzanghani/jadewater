-- ============================================================================
-- 월 매출 목표: 매장·월별 목표 금액. 홈의 "월 매출 목표" 표에서 목표·누적·달성률·월말 예상을 보여준다.
-- 읽기는 지점장·마스터, 쓰기는 본사 마스터만. 여러 번 실행해도 안전합니다.
-- ============================================================================
create table if not exists public.store_monthly_targets (
  store_id uuid not null references public.stores (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  target integer not null check (target >= 0),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  primary key (store_id, month)
);
alter table public.store_monthly_targets enable row level security;
drop policy if exists "store_monthly_targets_select" on public.store_monthly_targets;
drop policy if exists "store_monthly_targets_insert" on public.store_monthly_targets;
drop policy if exists "store_monthly_targets_update" on public.store_monthly_targets;
drop policy if exists "store_monthly_targets_delete" on public.store_monthly_targets;
create policy "store_monthly_targets_select" on public.store_monthly_targets for select to authenticated using (public.user_is_store_manager(store_id));
create policy "store_monthly_targets_insert" on public.store_monthly_targets for insert to authenticated with check (public.user_is_hq_master());
create policy "store_monthly_targets_update" on public.store_monthly_targets for update to authenticated using (public.user_is_hq_master()) with check (public.user_is_hq_master());
create policy "store_monthly_targets_delete" on public.store_monthly_targets for delete to authenticated using (public.user_is_hq_master());
