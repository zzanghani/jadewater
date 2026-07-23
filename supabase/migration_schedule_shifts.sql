-- ============================================================================
-- 근무 스케줄러 (매장별 월간 근무표)
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

create table if not exists public.schedule_shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  date date not null,
  role text not null check (role in ('점장', '부점장', '팀장', '사원', '파트타이머')),
  employee_name text not null,
  start_time time not null,
  end_time time not null,
  notes text,

  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schedule_shifts enable row level security;

create policy "schedule_shifts_select_authenticated"
  on public.schedule_shifts for select
  to authenticated
  using (public.user_can_access_store(store_id));

create policy "schedule_shifts_insert_authenticated"
  on public.schedule_shifts for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

create policy "schedule_shifts_update_authenticated"
  on public.schedule_shifts for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));

create policy "schedule_shifts_delete_authenticated"
  on public.schedule_shifts for delete
  to authenticated
  using (public.user_can_access_store(store_id));

create index if not exists schedule_shifts_store_date_idx on public.schedule_shifts (store_id, date);

create or replace function public.schedule_shifts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schedule_shifts_updated_at on public.schedule_shifts;
create trigger schedule_shifts_updated_at
  before update on public.schedule_shifts
  for each row execute function public.schedule_shifts_set_updated_at();
