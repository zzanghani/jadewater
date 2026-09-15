-- ============================================================================
-- 마케팅팀 계정에게 매장별 마감 내역(달력 + 마감보고, /store/[id])을 "보기 전용"으로
-- 열어준다. 홈 화면의 실시간매출 카드(마스터와 동일)에서 매장을 누르면 이 화면으로 간다.
--
-- daily_closings의 SELECT 정책만 바꾼다. 스케줄·입고(receipts)·코스트는 그대로
-- 매장 계정 + 마스터 + R&D만 본다(user_can_view_store_ops). 입력·수정 권한은 변함 없음.
-- 여러 번 실행해도 안전합니다.
-- ============================================================================

create or replace function public.user_can_view_closings(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_can_view_store_ops(target_store_id)
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
        and status = 'approved'
        and department = 'marketing'
    );
$$;

drop policy if exists "daily_closings_select_authenticated" on public.daily_closings;
create policy "daily_closings_select_authenticated"
  on public.daily_closings for select
  to authenticated
  using (public.user_can_view_closings(store_id));
