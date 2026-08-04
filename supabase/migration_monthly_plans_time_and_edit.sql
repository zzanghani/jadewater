-- ============================================================================
-- 월간계획: 시작/종료 시간 필드 추가 + 작성자 본인 수정 권한 추가
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

alter table public.monthly_plans add column if not exists start_time text;
alter table public.monthly_plans add column if not exists end_time text;

-- 기존에는 update 정책이 아예 없어서 수정 자체가 막혀 있었다. 작성자
-- 본인만 수정할 수 있게 새로 연다.
drop policy if exists "monthly_plans_update_own" on public.monthly_plans;
create policy "monthly_plans_update_own"
  on public.monthly_plans for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);
