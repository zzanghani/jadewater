-- ============================================================================
-- R&D팀 계정에 재고관리(inventory_items/inventory_counts) 접근 허용
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 기존 user_can_access_store_ops()는 department가 있는 본사 팀 계정을 전부
-- 차단해서(마감입력/입금요청 등 재무 데이터 보호 목적), R&D팀도 재고관리에
-- 들어올 수 없었다. R&D팀만 예외로 열어주되, HR과 마찬가지로 매장 구분 없이
-- 전 매장 재고를 볼 수 있게 한다(매장은 /inventory 화면 상단 매장 선택으로 고른다).
-- ============================================================================

create or replace function public.user_can_access_inventory(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_can_access_store_ops(target_store_id)
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and department = 'rnd'
    );
$$;

drop policy if exists "inventory_items_select_authenticated" on public.inventory_items;
create policy "inventory_items_select_authenticated"
  on public.inventory_items for select
  to authenticated
  using (public.user_can_access_inventory(store_id));

drop policy if exists "inventory_items_insert_authenticated" on public.inventory_items;
create policy "inventory_items_insert_authenticated"
  on public.inventory_items for insert
  to authenticated
  with check (public.user_can_access_inventory(store_id) and auth.uid() = created_by);

drop policy if exists "inventory_items_update_authenticated" on public.inventory_items;
create policy "inventory_items_update_authenticated"
  on public.inventory_items for update
  to authenticated
  using (public.user_can_access_inventory(store_id))
  with check (public.user_can_access_inventory(store_id));

drop policy if exists "inventory_items_delete_authenticated" on public.inventory_items;
create policy "inventory_items_delete_authenticated"
  on public.inventory_items for delete
  to authenticated
  using (public.user_can_access_inventory(store_id));

drop policy if exists "inventory_counts_select_authenticated" on public.inventory_counts;
create policy "inventory_counts_select_authenticated"
  on public.inventory_counts for select
  to authenticated
  using (public.user_can_access_inventory(store_id));

drop policy if exists "inventory_counts_insert_authenticated" on public.inventory_counts;
create policy "inventory_counts_insert_authenticated"
  on public.inventory_counts for insert
  to authenticated
  with check (public.user_can_access_inventory(store_id) and auth.uid() = created_by);

drop policy if exists "inventory_counts_update_authenticated" on public.inventory_counts;
create policy "inventory_counts_update_authenticated"
  on public.inventory_counts for update
  to authenticated
  using (public.user_can_access_inventory(store_id))
  with check (public.user_can_access_inventory(store_id));
