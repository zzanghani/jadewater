-- ============================================================================
-- 본사 팀 계정(디자인/마케팅/운영/RnD)의 입금요청을 매장이 아닌 부서 소속으로 기록
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- (먼저 migration_payment_requests_team_access.sql이 적용되어 있어야 합니다)
--
-- 지금까지는 팀 계정도 입금요청을 올릴 때 "지점"을 하나 골라야 해서, 마스터
-- 화면에 실제로는 본사 팀이 올린 요청인데 특정 매장이 올린 것처럼 보였다.
-- store_id를 비워둘 수 있게 하고 department 컬럼을 추가해서, 팀 계정 요청은
-- 매장 대신 부서로 기록/표시되게 한다.
-- ============================================================================

alter table public.payment_requests
  alter column store_id drop not null;

alter table public.payment_requests
  add column if not exists department text
  check (department in ('design', 'marketing', 'ops', 'rnd'));
