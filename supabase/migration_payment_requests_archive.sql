-- ============================================================================
-- 입금요청 완료건 구글드라이브 보관 기능을 위한 권한 확장
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 기존 삭제 정책은 "요청 작성자 본인만" 삭제 가능이라, 마스터가 완료된
-- 요청을 구글드라이브로 옮긴 뒤 Supabase에서 지우려는 시도가 막혔다.
-- 마스터도 지울 수 있게 넓힌다.
-- ============================================================================

drop policy if exists "payment_requests_delete_own" on public.payment_requests;
create policy "payment_requests_delete_own"
  on public.payment_requests for delete
  to authenticated
  using (
    (public.user_can_access_store(store_id) and auth.uid() = created_by)
    or public.user_is_master()
  );
