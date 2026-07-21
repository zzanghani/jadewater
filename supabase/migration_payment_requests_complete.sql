-- ============================================================================
-- 입금요청 완료 처리 마이그레이션
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

alter table public.payment_requests add column if not exists completed_at timestamptz;

drop policy if exists "payment_requests_update_authenticated" on public.payment_requests;
create policy "payment_requests_update_authenticated"
  on public.payment_requests for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));

create index if not exists payment_requests_completed_at_idx on public.payment_requests (completed_at);
