-- ============================================================================
-- 자기평가 — 직원 본인이 자기 평가표를 열려면 자기 명부 row를 읽을 수 있어야 한다.
--
-- 지금 employees select 정책은 HR 관리 권한자(대표/운영팀/R&D팀장/지점장)만
-- 통과시킨다. 직원 본인이 자기 직급·팀·입사일을 못 읽으면 어떤 평가표를
-- 써야 하는지 앱이 정할 수 없다. 본인 row 한 줄만 열어 준다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_employee_records.sql /
-- migration_attendance_damage_goals.sql을 먼저 실행한 뒤에 실행해야 합니다.
-- ============================================================================

drop policy if exists "employees_select_self" on public.employees;
create policy "employees_select_self"
  on public.employees for select
  to authenticated
  using (user_id = auth.uid());

-- 자기평가는 "확정 전까지" 쓸 수 있어야 한다. 그런데 아직 아무도 채점을
-- 시작하지 않은 분기에는 performance_reviews row 자체가 없어서, 직원이
-- 자기평가를 먼저 쓰면 row를 새로 만들게 된다. 그때 rubric_key/period가
-- 엉뚱하게 들어가지 않도록 본인 insert는 자기 employee_id로만 제한한다.
-- (migration_attendance_damage_goals.sql에서 이미 만든 정책을 확실히 해 둔다.)
drop policy if exists "performance_reviews_self_insert" on public.performance_reviews;
create policy "performance_reviews_self_insert"
  on public.performance_reviews for insert
  to authenticated
  with check (employee_id = public.my_employee_id());
