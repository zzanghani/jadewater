-- ============================================================================
-- 근무평가(정직원) 기능. 항목별 배점표는 화면 쪽 코드(lib/evalRubric.ts)에
-- 고정값으로 들어있고, 여기서는 사람별/월별 채점 결과만 저장한다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_hr_full_roster.sql /
-- migration_hr_resignation.sql을 먼저 실행한 뒤에 실행해야 합니다.
-- ============================================================================

create table if not exists public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  period text not null, -- 'YYYY-MM'
  team text not null check (team in ('홀', '키친')),
  scores jsonb not null,
  total_score int not null,
  comment text,
  evaluator_note text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, period)
);

alter table public.performance_reviews enable row level security;

-- employees와 동일하게 rnd/ops/마스터(HR팀)만 접근.
drop policy if exists "performance_reviews_select_hr" on public.performance_reviews;
create policy "performance_reviews_select_hr"
  on public.performance_reviews for select
  to authenticated
  using (public.user_is_hr_team());

drop policy if exists "performance_reviews_insert_hr" on public.performance_reviews;
create policy "performance_reviews_insert_hr"
  on public.performance_reviews for insert
  to authenticated
  with check (public.user_is_hr_team() and auth.uid() = created_by);

drop policy if exists "performance_reviews_update_hr" on public.performance_reviews;
create policy "performance_reviews_update_hr"
  on public.performance_reviews for update
  to authenticated
  using (public.user_is_hr_team())
  with check (public.user_is_hr_team());

drop policy if exists "performance_reviews_delete_hr" on public.performance_reviews;
create policy "performance_reviews_delete_hr"
  on public.performance_reviews for delete
  to authenticated
  using (public.user_is_hr_team());

create index if not exists performance_reviews_employee_id_idx on public.performance_reviews (employee_id);
