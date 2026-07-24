-- 근무 스케줄러: 한 번에 여러 날짜로 등록한 근무를 하나의 묶음으로 관리하기 위한 컬럼
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.

alter table public.schedule_shifts
  add column if not exists batch_id uuid;

create index if not exists schedule_shifts_batch_id_idx on public.schedule_shifts (batch_id);
