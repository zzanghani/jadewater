-- ============================================================================
-- 월말정산 테이블 추가 마이그레이션
-- 기존 프로젝트의 SQL Editor에서 실행하세요.
-- ============================================================================

create table if not exists public.monthly_settlements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  month date not null,
  manager_name text,

  labor_items jsonb not null default '[]'::jsonb,
  utility_items jsonb not null default '[]'::jsonb,
  hq_fee_items jsonb not null default '[]'::jsonb,

  pension_reserve numeric(12, 0) not null default 0,
  vat_reserve numeric(12, 0) not null default 0,
  corp_tax_reserve numeric(12, 0) not null default 0,
  reserve_carryover numeric(12, 0) not null default 0,
  reserve_deduction numeric(12, 0) not null default 0,
  discount_amount numeric(12, 0) not null default 0,

  notes text,
  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, month)
);

alter table public.monthly_settlements enable row level security;

drop policy if exists "monthly_settlements_select_authenticated" on public.monthly_settlements;
create policy "monthly_settlements_select_authenticated"
  on public.monthly_settlements for select
  to authenticated
  using (true);

drop policy if exists "monthly_settlements_insert_authenticated" on public.monthly_settlements;
create policy "monthly_settlements_insert_authenticated"
  on public.monthly_settlements for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "monthly_settlements_update_authenticated" on public.monthly_settlements;
create policy "monthly_settlements_update_authenticated"
  on public.monthly_settlements for update
  to authenticated
  using (true)
  with check (true);

drop trigger if exists monthly_settlements_set_updated_at on public.monthly_settlements;
create trigger monthly_settlements_set_updated_at
  before update on public.monthly_settlements
  for each row execute function public.set_updated_at();

create index if not exists monthly_settlements_month_idx on public.monthly_settlements (month desc);
create index if not exists monthly_settlements_store_id_idx on public.monthly_settlements (store_id);
