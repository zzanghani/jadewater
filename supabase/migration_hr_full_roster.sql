-- ============================================================================
-- HR 인력 현황 확장: 매장 소속 직원만 관리하던 employees 테이블을,
-- MSO운영회사(경영진/관리팀/마케팅팀/슈퍼바이저/디자인팀) 소속 인원과
-- 매장 홀/키친 팀 구분, 정직원/PT 구분, 연락처(전화/이메일/주소/생일)까지
-- 담을 수 있게 확장한다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_employees.sql /
-- migration_employees_health_cert_rename.sql을 먼저 실행한 뒤에 실행해야
-- 합니다.
-- ============================================================================

-- store_id가 있으면 매장 소속 직원, department가 있으면 MSO운영회사 소속
-- 인원 — 반드시 둘 중 하나만 채워지도록 store_id를 nullable로 바꾼다.
alter table public.employees alter column store_id drop not null;

alter table public.employees add column if not exists department text
  check (department in ('경영진', '관리팀', '마케팅팀', '슈퍼바이저', '디자인팀'));

alter table public.employees add column if not exists team text
  check (team in ('홀', '키친'));

alter table public.employees add column if not exists employment_type text
  not null default '정직원' check (employment_type in ('정직원', 'PT'));

alter table public.employees add column if not exists phone text;
alter table public.employees add column if not exists email text;
alter table public.employees add column if not exists address text;
alter table public.employees add column if not exists birthday date;

alter table public.employees drop constraint if exists employees_store_or_department_chk;
alter table public.employees add constraint employees_store_or_department_chk
  check ((store_id is not null) <> (department is not null));

-- RLS 정책은 매장 구분 없이 이미 user_is_hr_team()(rnd/ops/마스터)만
-- 허용하고 있어서 store_id가 nullable이 되어도 별도 변경이 필요 없다.
