-- 주간보고: 기간이 지나면 자동으로 구글드라이브에 백업하기 위한 처리 여부 컬럼
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.

alter table public.weekly_reports
  add column if not exists archived_at timestamptz;
