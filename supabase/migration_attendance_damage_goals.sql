-- ============================================================================
-- 근무평가 3종 확장
--   1. employee_attendance — 매장 지문인식 근태를 월말에 옮겨 담는 표.
--      분기 3개월치를 합산해 근태 문항을 자동 채점한다.
--   2. damage_records — 자산 분실·파손 기록. 한 달 3건 이상이면 등급 1단계 강등.
--   3. performance_reviews 확장 — 자기평가 / 다음 분기 목표 / 중간 체크인.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_employee_records.sql과
-- migration_performance_reviews.sql을 먼저 실행한 뒤에 실행해야 합니다.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. 근태 — 지문인식기 데이터를 월말에 직원별로 꽂는다.
--    분기 평가에서 3개월치를 합산해 5~1점으로 환산한다.
-- --------------------------------------------------------------------------
create table if not exists public.employee_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  -- 'YYYY-MM'
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  late_count int not null default 0 check (late_count >= 0),
  absent_count int not null default 0 check (absent_count >= 0),
  -- 무단결근은 따로 센다. 한 건만 있어도 근태 1점이다.
  unauthorized_count int not null default 0 check (unauthorized_count >= 0),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, month)
);

create index if not exists employee_attendance_month_idx
  on public.employee_attendance(month, store_id);

create or replace function public.employee_attendance_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.store_id is null then
    select e.store_id into new.store_id from public.employees e where e.id = new.employee_id;
  end if;
  return new;
end;
$$;

drop trigger if exists employee_attendance_touch_trg on public.employee_attendance;
create trigger employee_attendance_touch_trg
  before insert or update on public.employee_attendance
  for each row execute function public.employee_attendance_touch();

alter table public.employee_attendance enable row level security;

drop policy if exists "employee_attendance_select" on public.employee_attendance;
create policy "employee_attendance_select"
  on public.employee_attendance for select
  to authenticated
  using (
    public.can_record_employee(employee_id)
    or employee_id = public.my_employee_id()
  );

drop policy if exists "employee_attendance_write" on public.employee_attendance;
create policy "employee_attendance_write"
  on public.employee_attendance for all
  to authenticated
  using (public.can_record_employee(employee_id))
  with check (public.can_record_employee(employee_id));

-- --------------------------------------------------------------------------
-- 2. damage list — 자산 분실·파손 기록.
--    직원이 특정되지 않는 건(원인 불명)도 기록할 수 있어야 하므로
--    employee_id는 비워 둘 수 있다. 강등 판정은 직원이 지정된 건만 센다.
-- --------------------------------------------------------------------------
create table if not exists public.damage_records (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  occurred_on date not null default ((now() at time zone 'Asia/Seoul')::date),
  category text not null default '기물' check (category in ('기물', '비품', '시설', '식자재', '기타')),
  item_name text not null check (char_length(trim(item_name)) > 0),
  quantity int not null default 1 check (quantity > 0),
  reason text,
  status text not null default '확인중' check (status in ('확인중', '처리완료', '경고', '변상')),
  action_note text,
  amount int,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists damage_records_store_idx
  on public.damage_records(store_id, occurred_on desc);
create index if not exists damage_records_employee_idx
  on public.damage_records(employee_id, occurred_on desc);

create or replace function public.damage_records_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists damage_records_touch_trg on public.damage_records;
create trigger damage_records_touch_trg
  before insert or update on public.damage_records
  for each row execute function public.damage_records_touch();

alter table public.damage_records enable row level security;

drop policy if exists "damage_records_select" on public.damage_records;
create policy "damage_records_select"
  on public.damage_records for select
  to authenticated
  using (
    public.user_can_manage_hr(store_id)
    or (employee_id is not null and public.can_record_employee(employee_id))
    or employee_id = public.my_employee_id()
  );

drop policy if exists "damage_records_write" on public.damage_records;
create policy "damage_records_write"
  on public.damage_records for all
  to authenticated
  using (
    public.user_can_manage_hr(store_id)
    or (employee_id is not null and public.can_record_employee(employee_id))
  )
  with check (
    public.user_can_manage_hr(store_id)
    or (employee_id is not null and public.can_record_employee(employee_id))
  );

-- --------------------------------------------------------------------------
-- 3. performance_reviews 확장
--    자기평가는 점수에 반영하지 않는다 — 반영하면 부풀린다.
--    "내가 본 나"와 "남이 본 나"의 차이를 면담에서 보여주는 용도.
-- --------------------------------------------------------------------------
alter table public.performance_reviews
  add column if not exists self_scores jsonb not null default '{}'::jsonb,
  add column if not exists self_submitted_at timestamptz,
  add column if not exists next_goals text,
  add column if not exists midterm_good text,
  add column if not exists midterm_improve text,
  add column if not exists midterm_at timestamptz,
  -- damage list 3건 이상 등으로 등급을 한 단계 내렸을 때 사유를 남긴다.
  add column if not exists demotion_reason text;

-- 자기평가는 본인이 직접 써야 하므로 본인에게 insert/update 권한이 필요하다.
-- 확정 전(finalized_at is null)까지만 쓸 수 있다.
drop policy if exists "performance_reviews_self_insert" on public.performance_reviews;
create policy "performance_reviews_self_insert"
  on public.performance_reviews for insert
  to authenticated
  with check (employee_id = public.my_employee_id());

drop policy if exists "performance_reviews_self_update" on public.performance_reviews;
create policy "performance_reviews_self_update"
  on public.performance_reviews for update
  to authenticated
  using (employee_id = public.my_employee_id() and finalized_at is null)
  with check (employee_id = public.my_employee_id() and finalized_at is null);

-- 본인이 진행 중인 자기 평가 row를 볼 수 있어야 자기평가를 쓸 수 있다.
drop policy if exists "performance_reviews_select" on public.performance_reviews;
create policy "performance_reviews_select"
  on public.performance_reviews for select
  to authenticated
  using (
    public.can_record_employee(employee_id)
    or employee_id = public.my_employee_id()
  );
