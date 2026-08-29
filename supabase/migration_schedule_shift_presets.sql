-- ============================================================================
-- 근무 스케줄러 — 빠른입력 프리셋(오픈조/미들조/마감조 등). 매장마다 직접
-- 이름·시간·휴게시간을 정해서 관리하고, 스케줄 입력 팝업에서 버튼 하나로
-- 출근/퇴근/휴게시간을 채울 수 있게 한다.
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

create table if not exists public.schedule_shift_presets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  name text not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0,

  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schedule_shift_presets enable row level security;

create policy "schedule_shift_presets_select_authenticated"
  on public.schedule_shift_presets for select
  to authenticated
  using (public.user_can_access_store(store_id));

create policy "schedule_shift_presets_insert_authenticated"
  on public.schedule_shift_presets for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

create policy "schedule_shift_presets_update_authenticated"
  on public.schedule_shift_presets for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));

create policy "schedule_shift_presets_delete_authenticated"
  on public.schedule_shift_presets for delete
  to authenticated
  using (public.user_can_access_store(store_id));

create index if not exists schedule_shift_presets_store_idx on public.schedule_shift_presets (store_id);

create or replace function public.schedule_shift_presets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schedule_shift_presets_updated_at on public.schedule_shift_presets;
create trigger schedule_shift_presets_updated_at
  before update on public.schedule_shift_presets
  for each row execute function public.schedule_shift_presets_set_updated_at();
