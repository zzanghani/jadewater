-- ============================================================================
-- 입금요청에 "급여" 구분을 추가하고, 급여 요청은 그 매장 지점장(owner)과
-- 본사 마스터(대표)만 등록·조회할 수 있게 한다.
--
-- 지금까지 급여도 일반 거래처 요청과 똑같이 이름·금액만 적는 구조라 시스템이
-- 구별을 못 했고, 본사 팀 계정(마케팅/디자인/운영/R&D)도 RLS상 조회가 가능했다.
-- 여러 번 실행해도 안전합니다. migration_payment_requests_block_staff.sql 이후에 실행.
-- ============================================================================

alter table public.payment_requests
  add column if not exists is_payroll boolean not null default false;

-- 급여 요청 접근: 그 매장 지점장(role=owner) 또는 본사 마스터(매장·부서 없는 owner).
-- 매장 미배정 상태의 승인된 직원(staff) 계정은 store_id가 비어 있어도 제외된다.
create or replace function public.user_can_access_payroll_requests(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and department is null
      and role = 'owner'
      and status = 'approved'
      and (store_id is null or store_id = target_store_id)
  );
$$;

drop policy if exists "payment_requests_select_authenticated" on public.payment_requests;
create policy "payment_requests_select_authenticated"
  on public.payment_requests for select
  to authenticated
  using (
    public.user_can_access_payment_requests(store_id)
    and (not is_payroll or public.user_can_access_payroll_requests(store_id))
  );

drop policy if exists "payment_requests_insert_authenticated" on public.payment_requests;
create policy "payment_requests_insert_authenticated"
  on public.payment_requests for insert
  to authenticated
  with check (
    public.user_can_access_payment_requests(store_id)
    and auth.uid() = created_by
    and (not is_payroll or public.user_can_access_payroll_requests(store_id))
  );

-- 과거 요청 중 거래처명에 그 매장 직원 이름이 들어간 건은 급여로 표시한다.
update public.payment_requests pr
set is_payroll = true
where pr.is_payroll = false
  and pr.store_id is not null
  and exists (
    select 1 from public.employees e
    where e.store_id = pr.store_id
      and length(replace(e.name, ' ', '')) >= 2
      and replace(pr.vendor_name, ' ', '') like '%' || replace(e.name, ' ', '') || '%'
  );
