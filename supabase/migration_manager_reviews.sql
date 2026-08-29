-- ============================================================================
-- 점장 분기 평가(manager_reviews).
--
-- 직원 평가(performance_reviews)와 구조가 달라 표를 따로 둔다. 점장은 1~5점
-- 관찰 문항이 아니라 항목마다 만점이 다르고, 절반 가까이를 앱이 자동 채점한다.
-- 채점자도 대표·미스터리 쇼퍼·SV 셋으로 나뉜다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_employee_records.sql을
-- 먼저 실행한 뒤에 실행해야 합니다.
-- ============================================================================

create table if not exists public.manager_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  period text not null check (period ~ '^[0-9]{4}-Q[1-4]$'),

  -- 항목 id → 점수. 자동/수동을 한 곳에 담고, 자동 항목은 확정할 때
  -- 서버가 다시 계산해 덮어쓴다.
  scores jsonb not null default '{}'::jsonb,
  -- 자동 산출 근거를 확정 시점 그대로 굳혀 둔다. 나중에 마감·정산이
  -- 수정돼도 그때 왜 그 점수였는지 남아 있어야 한다.
  auto_snapshot jsonb not null default '{}'::jsonb,
  comment text,

  -- 개점 초기 계획된 적자, 리모델링·휴업이 낀 분기는 손익 게이트를 면제한다.
  gate_exempt boolean not null default false,
  gate_applied boolean not null default false,
  quarter_profit bigint,

  total_score numeric,
  grade text check (grade in ('S', 'A', 'B', 'C', 'D')),
  finalized_at timestamptz,
  finalized_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (employee_id, period)
);

create index if not exists manager_reviews_period_idx
  on public.manager_reviews(period, store_id);

create or replace function public.manager_reviews_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.store_id is null then
    select e.store_id into new.store_id from public.employees e where e.id = new.employee_id;
  end if;
  return new;
end;
$$;

drop trigger if exists manager_reviews_touch_trg on public.manager_reviews;
create trigger manager_reviews_touch_trg
  before insert or update on public.manager_reviews
  for each row execute function public.manager_reviews_touch();

-- --------------------------------------------------------------------------
-- RLS — 점장 평가는 HR 권한자(대표·운영팀·R&D팀장)만 채점한다.
-- 지점장 본인은 확정된 자기 평가만 볼 수 있다(can_record_employee는
-- 지점장에게 자기 매장 직원 권한을 주므로 여기선 쓰지 않는다 —
-- 점장이 자기 평가를 스스로 매기면 안 된다).
-- --------------------------------------------------------------------------
alter table public.manager_reviews enable row level security;

drop policy if exists "manager_reviews_select" on public.manager_reviews;
create policy "manager_reviews_select"
  on public.manager_reviews for select
  to authenticated
  using (
    public.user_is_hr_team()
    or (finalized_at is not null and employee_id = public.my_employee_id())
  );

drop policy if exists "manager_reviews_write" on public.manager_reviews;
create policy "manager_reviews_write"
  on public.manager_reviews for all
  to authenticated
  using (public.user_is_hr_team())
  with check (public.user_is_hr_team());
