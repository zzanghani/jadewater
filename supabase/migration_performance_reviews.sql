-- ============================================================================
-- 근무평가(performance_reviews): 직급별 평가표 채점 결과.
--
-- 1차(점장 70%) / 2차(부점장·팀장 또는 SV 30%)를 각각 저장하고, 총점은
-- 앱이 카테고리 가중치로 100점 환산해 계산한다. 문항·배점은 코드
-- (lib/evalRubric.ts)에 두고 DB에는 사람별·분기별 점수만 남긴다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_employee_records.sql을
-- 먼저 실행한 뒤에 실행해야 합니다.
-- ============================================================================

create table if not exists public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  -- 'YYYY-Qn'
  period text not null check (period ~ '^[0-9]{4}-Q[1-4]$'),
  -- 어떤 평가표로 채점했는지 (regular-hall / probation-kitchen / leader / deputy ...)
  rubric_key text not null,

  -- 1차: 점장
  first_scores jsonb not null default '{}'::jsonb,
  first_comment text,
  first_by uuid references auth.users(id) on delete set null,
  first_submitted_at timestamptz,

  -- 2차: 부점장·팀장 또는 SV
  second_scores jsonb not null default '{}'::jsonb,
  second_comment text,
  second_by uuid references auth.users(id) on delete set null,
  second_submitted_at timestamptz,

  -- 확정 시점에 계산해 굳혀 둔다. 나중에 평가표 문항이 바뀌어도
  -- 지난 분기 등급이 흔들리지 않아야 한다.
  total_score numeric,
  grade text check (grade in ('S', 'A', 'B', 'C', 'D')),
  finalized_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (employee_id, period)
);

create index if not exists performance_reviews_period_idx
  on public.performance_reviews(period, store_id);

create or replace function public.performance_reviews_touch()
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

drop trigger if exists performance_reviews_touch_trg on public.performance_reviews;
create trigger performance_reviews_touch_trg
  before insert or update on public.performance_reviews
  for each row execute function public.performance_reviews_touch();

-- --------------------------------------------------------------------------
-- RLS — 기록과 같은 권한을 쓴다. can_record_employee가 이미
-- "이 사람을 평가·기록할 수 있는가"를 판단한다(HR 권한자 + 상위 직급).
-- 직원 본인은 확정된(finalized) 자기 평가만 볼 수 있다.
-- --------------------------------------------------------------------------
alter table public.performance_reviews enable row level security;

drop policy if exists "performance_reviews_select" on public.performance_reviews;
create policy "performance_reviews_select"
  on public.performance_reviews for select
  to authenticated
  using (
    public.can_record_employee(employee_id)
    or (finalized_at is not null and employee_id = public.my_employee_id())
  );

drop policy if exists "performance_reviews_insert" on public.performance_reviews;
create policy "performance_reviews_insert"
  on public.performance_reviews for insert
  to authenticated
  with check (public.can_record_employee(employee_id));

drop policy if exists "performance_reviews_update" on public.performance_reviews;
create policy "performance_reviews_update"
  on public.performance_reviews for update
  to authenticated
  using (public.can_record_employee(employee_id))
  with check (public.can_record_employee(employee_id));

-- 확정된 평가는 지우지 못한다. 연봉·재계약 근거이기 때문.
drop policy if exists "performance_reviews_delete" on public.performance_reviews;
create policy "performance_reviews_delete"
  on public.performance_reviews for delete
  to authenticated
  using (public.can_record_employee(employee_id) and finalized_at is null);
