-- ============================================================================
-- 입금요청(payment_requests)을 직원(staff) 계정이 못 보게 막는다.
--
-- 지금까지는 user_can_access_store_ops 기준이라 같은 매장 직원 계정도 입금요청
-- 목록(급여 요청의 이름·금액·계좌 포함)을 조회할 수 있었다. 완료 알람을 누르면
-- 그 화면으로 바로 들어가져서 급여가 직원들에게 공개되는 일이 있었다(2026-09).
-- 지점장(owner)·마스터·본사 팀 계정만 보도록 좁힌다. 여러 번 실행해도 안전합니다.
-- ============================================================================

create or replace function public.user_can_access_payment_requests(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_is_store_manager(target_store_id)
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and department is not null
    );
$$;
