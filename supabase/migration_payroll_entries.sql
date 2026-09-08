-- ============================================================================
-- 급여신고 (매장별 월 급여 내역) 테이블
-- Supabase SQL Editor에서 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 지점장이 매달 직원별 기본급·상여금·추가수당을 정리해 두는 용도.
-- 급여는 민감정보라 매장 직원(staff)·본사 팀 계정은 못 보고,
-- 해당 매장 지점장(owner)과 마스터만 읽고 쓴다 (user_is_store_manager).
-- ============================================================================

create table if not exists public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  -- 해당 월의 1일 (YYYY-MM-01)
  month date not null,
  employee_name text not null,
  position text check (position in ('점장', '부점장', '팀장', '사원', '파트타이머')),
  base_pay numeric(12, 0) not null default 0,
  bonus numeric(12, 0) not null default 0,
  extra_pay numeric(12, 0) not null default 0,
  notes text,
  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payroll_entries enable row level security;

drop policy if exists "payroll_entries_select_manager" on public.payroll_entries;
create policy "payroll_entries_select_manager"
  on public.payroll_entries for select
  to authenticated
  using (public.user_is_store_manager(store_id));

drop policy if exists "payroll_entries_insert_manager" on public.payroll_entries;
create policy "payroll_entries_insert_manager"
  on public.payroll_entries for insert
  to authenticated
  with check (public.user_is_store_manager(store_id) and auth.uid() = created_by);

drop policy if exists "payroll_entries_update_manager" on public.payroll_entries;
create policy "payroll_entries_update_manager"
  on public.payroll_entries for update
  to authenticated
  using (public.user_is_store_manager(store_id))
  with check (public.user_is_store_manager(store_id));

drop policy if exists "payroll_entries_delete_manager" on public.payroll_entries;
create policy "payroll_entries_delete_manager"
  on public.payroll_entries for delete
  to authenticated
  using (public.user_is_store_manager(store_id));

drop trigger if exists payroll_entries_set_updated_at on public.payroll_entries;
create trigger payroll_entries_set_updated_at
  before update on public.payroll_entries
  for each row execute function public.set_updated_at();

create index if not exists payroll_entries_store_month_idx
  on public.payroll_entries (store_id, month desc);

-- 파트타이머는 시급 × 근무시간으로 급여를 계산한다. base_pay에는 계산 결과가 들어간다.
alter table public.payroll_entries add column if not exists hourly_rate numeric(10, 0);
alter table public.payroll_entries add column if not exists work_hours numeric(6, 1);

-- 프리랜서(3.3% 사업소득 신고자) 유형 추가.
alter table public.payroll_entries drop constraint if exists payroll_entries_position_check;
alter table public.payroll_entries add constraint payroll_entries_position_check
  check (position in ('점장', '부점장', '팀장', '사원', '파트타이머', '프리랜서'));
