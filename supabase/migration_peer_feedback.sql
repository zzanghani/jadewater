-- ============================================================================
-- 근무평가 결과 화면에 "참고용"으로 보여줄 동료 피드백. 점수/등급 계산에는
-- 전혀 반영되지 않고, 그냥 참고 자료로만 노출한다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_performance_reviews.sql을
-- 먼저 실행한 뒤에 실행해야 합니다.
-- ============================================================================

create table if not exists public.peer_feedback (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  period text not null, -- 'YYYY-MM'
  reviewer_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.peer_feedback enable row level security;

-- 일단 근무평가와 동일하게 rnd/ops/마스터(HR팀)만 접근.
drop policy if exists "peer_feedback_select_hr" on public.peer_feedback;
create policy "peer_feedback_select_hr"
  on public.peer_feedback for select
  to authenticated
  using (public.user_is_hr_team());

drop policy if exists "peer_feedback_insert_hr" on public.peer_feedback;
create policy "peer_feedback_insert_hr"
  on public.peer_feedback for insert
  to authenticated
  with check (public.user_is_hr_team() and auth.uid() = created_by);

drop policy if exists "peer_feedback_delete_hr" on public.peer_feedback;
create policy "peer_feedback_delete_hr"
  on public.peer_feedback for delete
  to authenticated
  using (public.user_is_hr_team());

create index if not exists peer_feedback_employee_period_idx on public.peer_feedback (employee_id, period);
