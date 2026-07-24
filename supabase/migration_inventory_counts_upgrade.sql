-- ============================================================================
-- 이미 예전 버전의 재고관리 SQL(quantity 컬럼이 inventory_items에 있는 버전)을
-- 실행했다면 이 파일을 실행하세요. (처음 실행하는 거라면 이 파일 대신
-- migration_inventory_items.sql을 실행하면 됩니다.)
-- ============================================================================

alter table public.inventory_items drop column if exists quantity;

create table if not exists public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  store_id uuid not null references public.stores (id),
  date date not null,
  quantity numeric not null default 0,

  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (item_id, date)
);

alter table public.inventory_counts enable row level security;

create policy "inventory_counts_select_authenticated"
  on public.inventory_counts for select
  to authenticated
  using (public.user_can_access_store(store_id));

create policy "inventory_counts_insert_authenticated"
  on public.inventory_counts for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

create policy "inventory_counts_update_authenticated"
  on public.inventory_counts for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));

create index if not exists inventory_counts_item_date_idx on public.inventory_counts (item_id, date);
create index if not exists inventory_counts_store_date_idx on public.inventory_counts (store_id, date);

create or replace function public.inventory_counts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_counts_updated_at on public.inventory_counts;
create trigger inventory_counts_updated_at
  before update on public.inventory_counts
  for each row execute function public.inventory_counts_set_updated_at();
