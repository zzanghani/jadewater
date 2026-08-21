-- ============================================================================
-- 입고 등록 화면의 "최근 거래처" 추천 목록에서, 중복/오기입으로 더 이상
-- 추천 목록에 뜨지 않았으면 하는 거래처명을 매장별로 숨기기 위한 테이블.
-- 실제 입고 내역(receipts)이나 집계에는 전혀 영향을 주지 않고,
-- 추천 목록에서만 제외한다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루
-- 두 프로젝트 모두 각각 실행해야 합니다.
-- ============================================================================

create table if not exists public.hidden_suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  supplier text not null,
  hidden_by uuid not null references auth.users (id),
  hidden_at timestamptz not null default now(),
  unique (store_id, supplier)
);

alter table public.hidden_suppliers enable row level security;

drop policy if exists "hidden_suppliers_select_authenticated" on public.hidden_suppliers;
create policy "hidden_suppliers_select_authenticated"
  on public.hidden_suppliers for select
  using (public.user_can_access_store(store_id));

drop policy if exists "hidden_suppliers_insert_authenticated" on public.hidden_suppliers;
create policy "hidden_suppliers_insert_authenticated"
  on public.hidden_suppliers for insert
  with check (public.user_can_access_store(store_id) and auth.uid() = hidden_by);

drop policy if exists "hidden_suppliers_delete_authenticated" on public.hidden_suppliers;
create policy "hidden_suppliers_delete_authenticated"
  on public.hidden_suppliers for delete
  using (public.user_can_access_store(store_id));
