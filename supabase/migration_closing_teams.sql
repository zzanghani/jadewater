-- ============================================================================
-- 일 마감: 런치/디너 팀수 추가, 하남은 방문팀수만 별도로 기입
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 기존에는 런치/디너 객수만 있었는데, 팀(테이블) 수도 각각 따로 기입할 수
-- 있게 한다. 하남은 브레이크타임이 없고 몰 안에 있어 인원 카운팅이
-- 어려우므로, 런치/디너 구분 없이 "총 방문팀"만 기입하는 별도 컬럼을 둔다.
-- ============================================================================

alter table public.daily_closings
  add column if not exists lunch_teams integer not null default 0;

alter table public.daily_closings
  add column if not exists dinner_teams integer not null default 0;

alter table public.daily_closings
  add column if not exists total_teams integer
  generated always as (lunch_teams + dinner_teams) stored;

alter table public.daily_closings
  add column if not exists visit_teams integer not null default 0;
