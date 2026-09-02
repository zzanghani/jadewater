-- ============================================================================
-- R&D팀 계정에게 스케줄러·실시간 코스트·요일별 분석을 "보기 전용"으로 열어준다.
-- 입력/수정 권한은 그대로 매장 계정(과 마스터)만 갖는다 — R&D는 조회만.
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다.
-- ============================================================================

create or replace function public.user_can_view_store_ops(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        (department is null and (store_id is null or store_id = target_store_id))
        or department = 'rnd'
      )
  );
$$;

drop policy if exists "daily_closings_select_authenticated" on public.daily_closings;
create policy "daily_closings_select_authenticated"
  on public.daily_closings for select
  to authenticated
  using (public.user_can_view_store_ops(store_id));

drop policy if exists "schedule_shifts_select_authenticated" on public.schedule_shifts;
create policy "schedule_shifts_select_authenticated"
  on public.schedule_shifts for select
  to authenticated
  using (public.user_can_view_store_ops(store_id));

-- 실시간 코스트 화면은 receipts(입고 기록)도 읽어야 코스트율이 제대로 나온다.
drop policy if exists "receipts_select_authenticated" on public.receipts;
create policy "receipts_select_authenticated"
  on public.receipts for select
  to authenticated
  using (public.user_can_view_store_ops(store_id));
