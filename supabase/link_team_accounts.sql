-- ============================================================================
-- 본사 팀 계정 ↔ department 연결
-- 4개 팀 계정을 Supabase 대시보드(Authentication → Users → Add user,
-- "Auto Confirm User" 체크)로 먼저 만든 뒤 이 SQL을 실행하세요.
-- 이메일은 예시이니 실제 만든 이메일로 바꿔서 실행하세요.
-- store_id는 건드리지 않습니다(NULL 유지 — 그래야 게시판/주간보고를 전 매장
-- 기준으로 볼 수 있습니다). department만 채우면 migration_team_accounts.sql의
-- RLS가 자동으로 매장 운영/재무 데이터 접근을 막습니다.
-- ============================================================================

update public.profiles
set department = 'design', name = '디자인팀'
where email = 'design@jadewater.com';

update public.profiles
set department = 'marketing', name = '마케팅팀'
where email = 'marketing@jadewater.com';

update public.profiles
set department = 'ops', name = '운영팀'
where email = 'ops@jadewater.com';

update public.profiles
set department = 'rnd', name = 'R&D팀'
where email = 'rnd@jadewater.com';

-- 확인: 각 계정의 department가 잘 채워졌는지, store_id는 NULL인지 조회
select email, name, department, store_id
from public.profiles
where department is not null
order by department;
