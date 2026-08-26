-- ============================================================================
-- 사건 기록(employee_records): 점장·부점장·팀장이 그날그날 직원에 대해
-- 남기는 짧은 칭찬/지적 기록. 분기 말 근무평가에서 문항별 근거 자료로 쓴다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_employees.sql /
-- migration_employee_accounts.sql / migration_hr_store_manager_access.sql을
-- 먼저 실행한 뒤에 실행해야 합니다.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. employees.user_id — 직원 명부 row와 로그인 계정을 연결한다.
--
--    지금까지는 둘이 따로 놀았다(명부는 employees, 계정은 profiles).
--    기록을 "부점장·팀장도 남길 수 있게" 하려면 로그인한 사람의 직급을
--    알아야 하고, 나중에 칭찬을 본인에게 보여주려면 반대 방향도 필요하다.
-- --------------------------------------------------------------------------
alter table public.employees
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists employees_user_id_key
  on public.employees(user_id) where user_id is not null;

-- --------------------------------------------------------------------------
-- 2. 직급 서열 — 누가 누구를 기록할 수 있는지 판단하는 기준.
--    숫자가 클수록 위. 아래에서 위로는 기록할 수 없다.
-- --------------------------------------------------------------------------
-- 인자 이름을 p_position으로 둔다 — position은 PostgreSQL 예약어라
-- 인자명으로 쓰면 syntax error가 난다.
create or replace function public.employee_rank(p_position text)
returns int
language sql
immutable
as $$
  select case p_position
    when '점장' then 40
    when '부점장' then 30
    when '팀장' then 20
    when '사원' then 10
    when '파트타이머' then 5
    else 0
  end;
$$;

-- 로그인한 사람의 employees row (계정이 연결되어 있을 때만)
create or replace function public.my_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.employees
  where user_id = auth.uid() and resigned_at is null
  limit 1;
$$;

-- --------------------------------------------------------------------------
-- 3. 기록 작성 권한
--    (1) HR 관리 권한자(대표/운영팀/R&D팀장) + 자기 매장 지점장 계정
--    (2) 같은 매장의 부점장·팀장이, 자기보다 아래 직급 직원에 대해
--    본인에 대한 기록은 어느 경우에도 남길 수 없다.
-- --------------------------------------------------------------------------
create or replace function public.can_record_employee(target_employee_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target record;
  me record;
begin
  -- position은 예약어라 레코드 필드로 쓸 때도 별칭을 붙여 둔다.
  select e.id, e.store_id, e.position as emp_position, e.user_id
    into target
  from public.employees e
  where e.id = target_employee_id;

  if target.id is null then
    return false;
  end if;

  -- 본인에 대한 기록은 금지
  if target.user_id is not null and target.user_id = auth.uid() then
    return false;
  end if;

  -- (1) 기존 HR 관리 권한 그대로 (지점장 계정 포함)
  if public.user_can_manage_hr(target.store_id) then
    return true;
  end if;

  -- (2) 같은 매장 부점장·팀장이 자기보다 아래 직급에 대해
  select e.store_id, e.position as emp_position
    into me
  from public.employees e
  where e.user_id = auth.uid() and e.resigned_at is null
  limit 1;

  if me.store_id is null then
    return false;
  end if;

  return me.store_id = target.store_id
    and public.employee_rank(me.emp_position) >= 20
    and public.employee_rank(me.emp_position) > public.employee_rank(target.emp_position);
end;
$$;

-- --------------------------------------------------------------------------
-- 4. employee_records
-- --------------------------------------------------------------------------
create table if not exists public.employee_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  kind text not null check (kind in ('칭찬', '지적')),
  body text not null check (char_length(trim(body)) > 0),
  occurred_on date not null default ((now() at time zone 'Asia/Seoul')::date),
  -- 평가 문항 태그. AI가 먼저 붙이고 사람이 고칠 수 있다.
  eval_item text,
  eval_item_source text not null default 'ai' check (eval_item_source in ('ai', 'manual')),
  -- 칭찬은 저장 즉시 본인에게 공개, 지적은 면담 전까지 비공개.
  shared_with_employee boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  edit_count int not null default 0
);

create index if not exists employee_records_employee_idx
  on public.employee_records(employee_id, occurred_on desc);
create index if not exists employee_records_store_idx
  on public.employee_records(store_id, occurred_on desc);

-- 칭찬은 항상 공개, 지적은 항상 비공개로 들어가게 강제한다.
-- (면담 때 공개하는 건 별도 동작으로, 아래 update 정책이 허용한다.)
create or replace function public.employee_records_defaults()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    new.shared_with_employee := (new.kind = '칭찬');
    if new.store_id is null then
      select e.store_id into new.store_id from public.employees e where e.id = new.employee_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists employee_records_defaults_trg on public.employee_records;
create trigger employee_records_defaults_trg
  before insert on public.employee_records
  for each row execute function public.employee_records_defaults();

-- 수정은 작성 후 24시간까지만. 그 뒤엔 이력이 남는다.
create or replace function public.employee_records_edit_guard()
returns trigger
language plpgsql
as $$
begin
  -- 공개 여부만 바뀌는 경우(면담 때 지적 공개)는 시간 제한 없음
  if new.body is distinct from old.body
     or new.kind is distinct from old.kind
     or new.occurred_on is distinct from old.occurred_on then
    if now() - old.created_at > interval '24 hours' then
      raise exception '작성 후 24시간이 지난 기록은 내용을 수정할 수 없습니다.';
    end if;
    new.edited_at := now();
    new.edit_count := old.edit_count + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists employee_records_edit_guard_trg on public.employee_records;
create trigger employee_records_edit_guard_trg
  before update on public.employee_records
  for each row execute function public.employee_records_edit_guard();

-- --------------------------------------------------------------------------
-- 5. RLS
-- --------------------------------------------------------------------------
alter table public.employee_records enable row level security;

-- 조회: 기록 권한자는 전부 / 직원 본인은 공개된 것만
drop policy if exists "employee_records_select" on public.employee_records;
create policy "employee_records_select"
  on public.employee_records for select
  to authenticated
  using (
    public.can_record_employee(employee_id)
    or (
      shared_with_employee
      and employee_id = public.my_employee_id()
    )
  );

drop policy if exists "employee_records_insert" on public.employee_records;
create policy "employee_records_insert"
  on public.employee_records for insert
  to authenticated
  with check (
    public.can_record_employee(employee_id)
    and auth.uid() = created_by
  );

-- 수정: 작성자 본인만 (내용 수정은 위 트리거가 24시간으로 제한).
-- 지적을 면담 때 공개하는 건 HR 관리 권한자도 할 수 있어야 한다.
drop policy if exists "employee_records_update" on public.employee_records;
create policy "employee_records_update"
  on public.employee_records for update
  to authenticated
  using (created_by = auth.uid() or public.can_record_employee(employee_id))
  with check (created_by = auth.uid() or public.can_record_employee(employee_id));

-- 삭제: 작성자 본인이 24시간 안에만. 그 뒤에는 지울 수 없다 —
-- 분기 말 평가의 근거가 사라지면 안 되기 때문.
drop policy if exists "employee_records_delete" on public.employee_records;
create policy "employee_records_delete"
  on public.employee_records for delete
  to authenticated
  using (
    created_by = auth.uid()
    and now() - created_at <= interval '24 hours'
  );
