-- ============================================================================
-- 본사 팀 계정(디자인/마케팅/운영/R&D) 전체에 입금요청 접근 허용
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 기존 user_can_access_store_ops()는 department가 있는 본사 팀 계정을 전부
-- 차단해서(마감입력/입금요청 등 재무 데이터 보호 목적) 팀 계정이 입금요청을
-- 등록/조회할 수 없었다. R&D 재고관리 때와 같은 패턴으로, department가 있는
-- 계정이면(부서 구분 없이) 예외로 열어준다. 완료 처리/삭제(보관)는 그대로
-- user_is_master()로 막혀 있어 팀 계정은 등록·조회만 가능하다.
-- ============================================================================

create or replace function public.user_can_access_payment_requests(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_can_access_store_ops(target_store_id)
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and department is not null
    );
$$;

drop policy if exists "payment_requests_select_authenticated" on public.payment_requests;
create policy "payment_requests_select_authenticated"
  on public.payment_requests for select
  to authenticated
  using (public.user_can_access_payment_requests(store_id));

drop policy if exists "payment_requests_insert_authenticated" on public.payment_requests;
create policy "payment_requests_insert_authenticated"
  on public.payment_requests for insert
  to authenticated
  with check (public.user_can_access_payment_requests(store_id) and auth.uid() = created_by);
