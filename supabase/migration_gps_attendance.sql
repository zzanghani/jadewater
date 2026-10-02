-- ============================================================================
-- GPS 출퇴근 기록 (사양서 "GPS 출퇴근 기능 사양서 v1.0" 기준)
--
-- - store_locations: 매장 좌표·허용 반경. 관리자(본사 마스터·그 매장 지점장)가
--   매장 단위로 1회 확정한다. 직원 계정은 profiles.store_id만 가진다.
-- - store_location_history: 좌표·반경을 바꿀 때 "변경 전 값"을 남긴다.
-- - attendance_records: 출근/퇴근 기록. 당시의 매장 좌표·반경·GPS 오차·거리를
--   같이 저장해서 매장 이전 뒤에도 과거 기록의 근거가 남는다.
--   client_record_id는 오프라인 큐 재전송 시 중복을 막는 멱등 키.
-- 여러 번 실행해도 안전합니다.
-- ============================================================================

create table if not exists public.store_locations (
  store_id uuid primary key references public.stores (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  -- 허용 반경(m). 기본 50, 최소 10 (10 미만 입력은 10으로 보정).
  radius_m integer not null default 50 check (radius_m >= 10),
  address text,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_location_history (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);

create index if not exists store_location_history_store_idx
  on public.store_location_history (store_id, changed_at desc);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  client_record_id text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  type text not null check (type in ('IN', 'OUT')),
  -- 기기 시각(출퇴근 버튼을 누른 시각)과 서버 수신 시각을 따로 둔다.
  recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  accuracy_m integer not null,
  distance_m integer not null,
  store_lat double precision not null,
  store_lng double precision not null,
  store_radius_m integer not null,
  -- 서버 재검증에서 "반경 밖"으로 판정됐지만 저장은 한 기록.
  flagged boolean not null default false,
  device_info text
);

create index if not exists attendance_records_store_time_idx
  on public.attendance_records (store_id, recorded_at desc);
create index if not exists attendance_records_user_time_idx
  on public.attendance_records (user_id, recorded_at desc);

-- 변경 전 값을 이력에 남기는 트리거.
create or replace function public.log_store_location_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and (old.lat is distinct from new.lat
          or old.lng is distinct from new.lng
          or old.radius_m is distinct from new.radius_m) then
    insert into public.store_location_history (store_id, lat, lng, radius_m, changed_by)
    values (old.store_id, old.lat, old.lng, old.radius_m, auth.uid());
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists store_locations_log_change on public.store_locations;
create trigger store_locations_log_change
  before update on public.store_locations
  for each row execute function public.log_store_location_change();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.store_locations enable row level security;
alter table public.store_location_history enable row level security;
alter table public.attendance_records enable row level security;

-- 매장 위치: 그 매장에 접근 가능한 누구나 읽고(출퇴근 화면이 거리 계산에 씀),
-- 쓰기는 본사 마스터·그 매장 지점장만.
drop policy if exists "store_locations_select" on public.store_locations;
create policy "store_locations_select"
  on public.store_locations for select
  to authenticated
  using (public.user_can_access_store(store_id));

drop policy if exists "store_locations_insert" on public.store_locations;
create policy "store_locations_insert"
  on public.store_locations for insert
  to authenticated
  with check (public.user_is_store_manager(store_id));

drop policy if exists "store_locations_update" on public.store_locations;
create policy "store_locations_update"
  on public.store_locations for update
  to authenticated
  using (public.user_is_store_manager(store_id))
  with check (public.user_is_store_manager(store_id));

drop policy if exists "store_location_history_select" on public.store_location_history;
create policy "store_location_history_select"
  on public.store_location_history for select
  to authenticated
  using (public.user_is_store_manager(store_id));

-- 출퇴근 기록: 본인 것은 누구나, 매장 전체는 지점장·마스터만 본다.
-- 기록은 본인 명의로, 자기 소속 매장에만 남길 수 있다.
drop policy if exists "attendance_records_select" on public.attendance_records;
create policy "attendance_records_select"
  on public.attendance_records for select
  to authenticated
  using (user_id = auth.uid() or public.user_is_store_manager(store_id));

drop policy if exists "attendance_records_insert" on public.attendance_records;
create policy "attendance_records_insert"
  on public.attendance_records for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.status = 'approved'
        and p.store_id = attendance_records.store_id
    )
  );

-- ----------------------------------------------------------------------------
-- 초기 매장 좌표 (사양서 3.1, 카카오맵 입구 기준 — 현장에서 "현재 위치로 설정"으로 보정)
-- 이미 값이 있으면 건드리지 않는다.
-- ----------------------------------------------------------------------------
insert into public.store_locations (store_id, lat, lng, radius_m, address)
select s.id, v.lat, v.lng, 50, v.address
from (values
  ('%성수%',   37.541731, 127.061553, '서울 성동구 연무장17길 10'),
  ('%옥수%',   37.542895, 127.015400, '서울 성동구 한림말3길 21-1'),
  ('제이드앤워터%서울역%', 37.557091, 126.974501, '서울 중구 퇴계로 15'),
  ('%하남%',   37.544957, 127.222881, '경기 하남시 미사대로 750')
) as v(pattern, lat, lng, address)
join public.stores s on s.name like v.pattern
on conflict (store_id) do nothing;
