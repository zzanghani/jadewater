-- ============================================================================
-- 재고관리 (홀/주방 품목별 수량 관리)
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  section text not null check (section in ('홀', '주방')),
  name text not null,
  quantity numeric not null default 0,
  unit text,
  notes text,

  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory_items enable row level security;

create policy "inventory_items_select_authenticated"
  on public.inventory_items for select
  to authenticated
  using (public.user_can_access_store(store_id));

create policy "inventory_items_insert_authenticated"
  on public.inventory_items for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

create policy "inventory_items_update_authenticated"
  on public.inventory_items for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));

create policy "inventory_items_delete_authenticated"
  on public.inventory_items for delete
  to authenticated
  using (public.user_can_access_store(store_id));

create index if not exists inventory_items_store_section_idx on public.inventory_items (store_id, section);

create or replace function public.inventory_items_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_items_updated_at on public.inventory_items;
create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.inventory_items_set_updated_at();
