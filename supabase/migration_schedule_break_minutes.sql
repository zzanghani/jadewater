-- 근무 스케줄러에 휴게시간(분) 컬럼 추가
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.

alter table public.schedule_shifts
  add column if not exists break_minutes integer not null default 0;
