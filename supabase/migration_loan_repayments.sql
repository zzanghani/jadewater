-- ============================================================================
-- 금전대차 상환표 (마스터 전용 간단 표)
-- Supabase SQL Editor에서 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 대표가 엑셀로 관리하던 "매장 / 투자자 / 투자금 / 상환액 / 상환비율" 표를
-- 그대로 옮긴 것. 매장은 아직 앱에 없는 곳(온다미, 고양)도 있어서 이름 글자로 둔다.
-- 남의 원금·상환액이 담기므로 본사 마스터(매장·부서 모두 없는 계정)만 읽고 쓴다.
-- ============================================================================

create or replace function public.user_is_hq_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and store_id is null
      and department is null
      and status = 'approved'
  );
$$;

create table if not exists public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  store_name text not null,
  investor_name text not null,
  principal numeric(14, 0) not null default 0,
  repaid numeric(14, 0) not null default 0,
  notes text,
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.loan_repayments enable row level security;

drop policy if exists "loan_repayments_select_master" on public.loan_repayments;
create policy "loan_repayments_select_master"
  on public.loan_repayments for select
  to authenticated
  using (public.user_is_hq_master());

drop policy if exists "loan_repayments_insert_master" on public.loan_repayments;
create policy "loan_repayments_insert_master"
  on public.loan_repayments for insert
  to authenticated
  with check (public.user_is_hq_master() and auth.uid() = created_by);

drop policy if exists "loan_repayments_update_master" on public.loan_repayments;
create policy "loan_repayments_update_master"
  on public.loan_repayments for update
  to authenticated
  using (public.user_is_hq_master())
  with check (public.user_is_hq_master());

drop policy if exists "loan_repayments_delete_master" on public.loan_repayments;
create policy "loan_repayments_delete_master"
  on public.loan_repayments for delete
  to authenticated
  using (public.user_is_hq_master());

drop trigger if exists loan_repayments_set_updated_at on public.loan_repayments;
create trigger loan_repayments_set_updated_at
  before update on public.loan_repayments
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- 엑셀(금전대차 상환표.xlsx, 2026-09-10)에 있던 값을 최초 1회만 넣는다.
-- 표가 비어 있을 때만 들어가므로 다시 실행해도 중복되지 않는다.
-- created_by는 본사 마스터 계정(매장·부서 없음) 중 하나로 잡는다.
-- --------------------------------------------------------------------------
insert into public.loan_repayments (store_name, investor_name, principal, repaid, sort_order, created_by)
select v.store_name, v.investor_name, v.principal, v.repaid, v.sort_order, m.id
from (values
  ('제이드앤워터 서울역',  '이창한', 250000000, 103500000, 10),
  ('제이드앤워터 서울역',  '이용탁',  50000000,  34506983, 11),
  ('제이드앤워터 옥수',    '이창한', 160000000,  69586191, 20),
  ('제이드앤워터 옥수',    '이승창',  28000000,   4700000, 21),
  ('제이드앤워터 성수LCDC','이창한',  37972260,  20500000, 30),
  ('제이드앤워터 성수LCDC','김도형',  35000000,  20500000, 31),
  ('제이드앤워터 하남',    '이창한',  82000000,  21600000, 40),
  ('제이드앤워터 하남',    '정성훈',  82000000,  21600000, 41),
  ('제이드앤워터 하남',    '이창민',  36000000,  10800000, 42),
  ('레스토랑 온다미',      '이창한',  65225180,         0, 50),
  ('레스토랑 온다미',      '유수민',         0,         0, 51),
  ('스타필드 고양',        '이창한',         0,         0, 60),
  ('스타필드 고양',        '정성훈',         0,         0, 61)
) as v(store_name, investor_name, principal, repaid, sort_order)
cross join lateral (
  select id from public.profiles
  where store_id is null and department is null and status = 'approved'
  order by created_at
  limit 1
) as m
where not exists (select 1 from public.loan_repayments);

-- --------------------------------------------------------------------------
-- 상환 기록 — 상환할 때마다 날짜·금액을 한 줄씩 남기고, 합계가 자동으로
-- loan_repayments.repaid에 반영된다 (트리거). 상환액을 손으로 고치지 않는다.
-- --------------------------------------------------------------------------
create table if not exists public.loan_repayment_events (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loan_repayments (id) on delete cascade,
  paid_on date not null,
  amount numeric(14, 0) not null,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.loan_repayment_events enable row level security;

drop policy if exists "loan_repayment_events_select_master" on public.loan_repayment_events;
create policy "loan_repayment_events_select_master"
  on public.loan_repayment_events for select
  to authenticated
  using (public.user_is_hq_master());

drop policy if exists "loan_repayment_events_insert_master" on public.loan_repayment_events;
create policy "loan_repayment_events_insert_master"
  on public.loan_repayment_events for insert
  to authenticated
  with check (public.user_is_hq_master() and auth.uid() = created_by);

drop policy if exists "loan_repayment_events_delete_master" on public.loan_repayment_events;
create policy "loan_repayment_events_delete_master"
  on public.loan_repayment_events for delete
  to authenticated
  using (public.user_is_hq_master());

create index if not exists loan_repayment_events_loan_idx
  on public.loan_repayment_events (loan_id, paid_on desc);

create or replace function public.sync_loan_repaid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.loan_id, old.loan_id);
begin
  update public.loan_repayments
  set repaid = coalesce((select sum(amount) from public.loan_repayment_events where loan_id = target), 0)
  where id = target;
  return null;
end;
$$;

drop trigger if exists loan_repayment_events_sync on public.loan_repayment_events;
create trigger loan_repayment_events_sync
  after insert or update or delete on public.loan_repayment_events
  for each row execute function public.sync_loan_repaid();

-- 엑셀에서 넘어온 상환액은 "이월" 기록 한 줄로 남긴다 (기록이 하나도 없는 줄만).
insert into public.loan_repayment_events (loan_id, paid_on, amount, notes, created_by)
select l.id, date '2026-09-10', l.repaid, '엑셀 이월', l.created_by
from public.loan_repayments l
where l.repaid > 0
  and not exists (select 1 from public.loan_repayment_events e where e.loan_id = l.id);
