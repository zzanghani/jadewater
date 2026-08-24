-- ============================================================================
-- 동료 피드백을 "관리자가 대신 입력"하던 방식에서 "같은 매장 동료가
-- 본인 계정으로 직접, 익명으로 입력"하는 방식으로 바꾼다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_peer_feedback.sql을
-- 먼저 실행한 뒤에 실행해야 합니다.
-- ============================================================================

-- 익명 피드백이라 누가 썼는지 화면에 보여줄 이름 자체를 안 받는다.
alter table public.peer_feedback drop column if exists reviewer_name;

-- 같은 사람이 같은 동료를 같은 달에 여러 번 평가하지 못하게.
alter table public.peer_feedback drop constraint if exists peer_feedback_unique_submission;
alter table public.peer_feedback add constraint peer_feedback_unique_submission
  unique (employee_id, period, created_by);

-- 매장이 같은 사람끼리만 서로 피드백을 줄 수 있게(또는 HR팀).
create or replace function public.user_can_give_peer_feedback(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    join public.profiles p on p.store_id = e.store_id
    where e.id = p_employee_id
      and p.id = auth.uid()
      and e.store_id is not null
  ) or public.user_is_hr_team();
$$;

drop policy if exists "peer_feedback_insert_hr" on public.peer_feedback;
drop policy if exists "peer_feedback_insert_store" on public.peer_feedback;
create policy "peer_feedback_insert_store"
  on public.peer_feedback for insert
  to authenticated
  with check (public.user_can_give_peer_feedback(employee_id) and auth.uid() = created_by);

-- 결과 목록 자체는 HR팀만 보고, 본인이 이미 제출했는지 확인하는 용도로
-- 본인이 쓴 것만 예외적으로 읽을 수 있게 한다(다른 사람 피드백은 못 봄 = 익명 유지).
drop policy if exists "peer_feedback_select_hr" on public.peer_feedback;
create policy "peer_feedback_select_hr_or_own"
  on public.peer_feedback for select
  to authenticated
  using (public.user_is_hr_team() or created_by = auth.uid());
