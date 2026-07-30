-- ============================================================================
-- 직원 HR 명단 (이름/직급/입사일자/보건증 갱신일자) — R&D팀/운영HR팀 전용 메뉴
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 매장 소속 직원 정보를 매장 구분 없이 한 화면에서 관리한다. 실제 접근은
-- department가 'rnd' 또는 'ops'인 본사 팀 계정만 가능하고, 마스터 계정도
-- (평소처럼 전체 데이터를 보므로) 접근할 수 있다. 매장 지점장/직원 계정과
-- 마케팅/디자인 팀 계정은 접근할 수 없다.
-- ============================================================================

create or replace function public.user_is_hr_team()
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
        department in ('rnd', 'ops')
        or (store_id is null and department is null) -- 마스터 계정
      )
  );
$$;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  name text not null,
  position text not null check (position in ('점장', '부점장', '팀장', '사원', '파트타이머')),
  hire_date date not null,
  health_cert_renewed_at date,
  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employees enable row level security;

drop policy if exists "employees_select_hr" on public.employees;
create policy "employees_select_hr"
  on public.employees for select
  to authenticated
  using (public.user_is_hr_team());

drop policy if exists "employees_insert_hr" on public.employees;
create policy "employees_insert_hr"
  on public.employees for insert
  to authenticated
  with check (public.user_is_hr_team() and auth.uid() = created_by);

drop policy if exists "employees_update_hr" on public.employees;
create policy "employees_update_hr"
  on public.employees for update
  to authenticated
  using (public.user_is_hr_team())
  with check (public.user_is_hr_team());

drop policy if exists "employees_delete_hr" on public.employees;
create policy "employees_delete_hr"
  on public.employees for delete
  to authenticated
  using (public.user_is_hr_team());

create index if not exists employees_store_id_idx on public.employees (store_id);
