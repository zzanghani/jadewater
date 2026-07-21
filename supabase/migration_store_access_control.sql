-- ============================================================================
-- 매장별 접근 제어 마이그레이션
-- SQL Editor에서 실행하세요.
--
-- profiles.store_id가 NULL이면 마스터 계정(전 지점), 값이 있으면 그 매장
-- 데이터만 보고 쓸 수 있습니다. 기존 계정(owner@jadewater.com)은 store_id가
-- 자동으로 NULL이라 그대로 마스터 계정이 됩니다.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. profiles.store_id 컬럼 + 접근 제어 함수/트리거
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

-- --------------------------------------------------------------------------
-- 2. stores
-- --------------------------------------------------------------------------
drop policy if exists "stores_select_authenticated" on public.stores;
create policy "stores_select_authenticated"
  on public.stores for select
  to authenticated
  using (public.user_can_access_store(id));

-- --------------------------------------------------------------------------
-- 3. daily_closings
-- --------------------------------------------------------------------------
drop policy if exists "daily_closings_select_authenticated" on public.daily_closings;
create policy "daily_closings_select_authenticated"
  on public.daily_closings for select
  to authenticated
  using (public.user_can_access_store(store_id));

drop policy if exists "daily_closings_insert_authenticated" on public.daily_closings;
create policy "daily_closings_insert_authenticated"
  on public.daily_closings for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

drop policy if exists "daily_closings_update_authenticated" on public.daily_closings;
create policy "daily_closings_update_authenticated"
  on public.daily_closings for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));

-- --------------------------------------------------------------------------
-- 4. payment_requests
-- --------------------------------------------------------------------------
drop policy if exists "payment_requests_select_authenticated" on public.payment_requests;
create policy "payment_requests_select_authenticated"
  on public.payment_requests for select
  to authenticated
  using (public.user_can_access_store(store_id));

drop policy if exists "payment_requests_insert_authenticated" on public.payment_requests;
create policy "payment_requests_insert_authenticated"
  on public.payment_requests for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

drop policy if exists "payment_requests_delete_own" on public.payment_requests;
create policy "payment_requests_delete_own"
  on public.payment_requests for delete
  to authenticated
  using (public.user_can_access_store(store_id) and auth.uid() = created_by);

-- --------------------------------------------------------------------------
-- 5. receipts
-- --------------------------------------------------------------------------
drop policy if exists "receipts_select_authenticated" on public.receipts;
create policy "receipts_select_authenticated"
  on public.receipts for select
  to authenticated
  using (public.user_can_access_store(store_id));

drop policy if exists "receipts_insert_authenticated" on public.receipts;
create policy "receipts_insert_authenticated"
  on public.receipts for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

drop policy if exists "receipts_update_authenticated" on public.receipts;
create policy "receipts_update_authenticated"
  on public.receipts for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));

drop policy if exists "receipts_delete_authenticated" on public.receipts;
create policy "receipts_delete_authenticated"
  on public.receipts for delete
  to authenticated
  using (public.user_can_access_store(store_id));

-- --------------------------------------------------------------------------
-- 6. monthly_settlements
-- --------------------------------------------------------------------------
drop policy if exists "monthly_settlements_select_authenticated" on public.monthly_settlements;
create policy "monthly_settlements_select_authenticated"
  on public.monthly_settlements for select
  to authenticated
  using (public.user_can_access_store(store_id));

drop policy if exists "monthly_settlements_insert_authenticated" on public.monthly_settlements;
create policy "monthly_settlements_insert_authenticated"
  on public.monthly_settlements for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

drop policy if exists "monthly_settlements_update_authenticated" on public.monthly_settlements;
create policy "monthly_settlements_update_authenticated"
  on public.monthly_settlements for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));
