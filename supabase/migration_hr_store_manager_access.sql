-- ============================================================================
-- HR(직원관리) 접근을 rnd/ops/마스터 전용에서, 지점장(owner) 계정도 "자기
-- 매장" 직원만 보고/등록/수정/퇴사처리할 수 있게 넓힌다. 대표님/운영팀/
-- R&D팀장은 기존처럼 전 매장을 다 본다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_hr_full_roster.sql /
-- migration_hr_resignation.sql을 먼저 실행한 뒤에 실행해야 합니다.
-- ============================================================================

create or replace function public.user_can_manage_hr(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_is_hr_team()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'owner'
        and p.department is null
        and p.store_id = target_store_id
    );
$$;

drop policy if exists "employees_select_hr" on public.employees;
create policy "employees_select_hr"
  on public.employees for select
  to authenticated
  using (public.user_can_manage_hr(store_id));

drop policy if exists "employees_insert_hr" on public.employees;
create policy "employees_insert_hr"
  on public.employees for insert
  to authenticated
  with check (public.user_can_manage_hr(store_id) and auth.uid() = created_by);

drop policy if exists "employees_update_hr" on public.employees;
create policy "employees_update_hr"
  on public.employees for update
  to authenticated
  using (public.user_can_manage_hr(store_id))
  with check (public.user_can_manage_hr(store_id));

drop policy if exists "employees_delete_hr" on public.employees;
create policy "employees_delete_hr"
  on public.employees for delete
  to authenticated
  using (public.user_can_manage_hr(store_id));
