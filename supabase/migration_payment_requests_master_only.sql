-- ============================================================================
-- 입금요청 완료 처리를 마스터 계정만 할 수 있도록 제한하는 마이그레이션
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

create or replace function public.user_is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and store_id is null
  );
$$;

drop policy if exists "payment_requests_update_authenticated" on public.payment_requests;
create policy "payment_requests_update_authenticated"
  on public.payment_requests for update
  to authenticated
  using (public.user_is_master())
  with check (public.user_is_master());
