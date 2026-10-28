-- ============================================================================
-- SECURITY DEFINER 함수 실행 권한 좁히기 (Supabase 보안 경고 0028 대응)
--
-- Postgres는 함수를 만들면 기본으로 모든 역할(PUBLIC)에 실행 권한을 준다.
-- 그래서 로그인 안 한 anon 키로도 /rest/v1/rpc/<함수> 를 부를 수 있었다.
-- 이 앱의 함수들은 전부 로그인한 사용자(RLS 정책 안의 권한 판정, 푸시 구독 저장,
-- 브랜드 관리자 비밀번호 확인)나 서비스 롤(크론)만 쓰므로 PUBLIC/anon 을 걷어낸다.
--
-- 유지: authenticated(RLS 정책이 사용자 권한으로 평가되므로 필요), service_role.
-- handle_new_user 는 auth.users 트리거라 supabase_auth_admin 에게도 준다.
-- 함수가 없는 환경(예: 그린에만 있는 함수)은 건너뛰도록 존재 여부를 확인한다.
-- 여러 번 실행해도 안전합니다.
-- ============================================================================

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'can_record_employee',
        'get_daily_closings_totals',
        'get_push_subscriptions_for_user',
        'handle_new_user',
        'is_chat_room_member',
        'log_store_location_change',
        'my_employee_id',
        'store_ad_account_status',
        'sync_loan_repaid',
        'upsert_push_subscription',
        'user_can_access_inventory',
        'user_can_access_payment_requests',
        'user_can_access_payroll_requests',
        'user_can_access_store',
        'user_can_access_store_ops',
        'user_can_dm',
        'user_can_give_peer_feedback',
        'user_can_manage_hr',
        'user_can_view_closings',
        'user_can_view_store_ops',
        'user_is_hq',
        'user_is_hq_master',
        'user_is_hr_team',
        'user_is_master',
        'user_is_store_manager',
        'user_is_store_staff',
        'verify_brand_admin_password'
      )
  loop
    execute format('revoke all on function %s from public', fn.sig);
    execute format('revoke all on function %s from anon', fn.sig);
    execute format('grant execute on function %s to authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
    if fn.proname = 'handle_new_user' then
      execute format('grant execute on function %s to supabase_auth_admin', fn.sig);
    end if;
  end loop;
end $$;
