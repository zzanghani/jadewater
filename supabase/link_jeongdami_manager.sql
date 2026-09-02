-- ============================================================================
-- 정다미 서울역점 지점장 계정 연결
--
-- 순서:
--  1) Supabase 대시보드 → Authentication → Users → Add user
--     - Email: 아래 :manager_email 과 똑같이
--     - Password: 원하는 비밀번호
--     - "Auto Confirm User" 체크 (안 하면 로그인이 막힙니다)
--  2) 이 파일 전체를 SQL Editor에 붙여넣고 실행
--
-- 주의: 이 SQL은 migration_brands.sql을 먼저 실행한 뒤에 돌려야 합니다.
--       (정다미 서울역점 매장이 그 마이그레이션에서 만들어집니다)
-- ============================================================================

-- ↓↓↓ 1단계에서 만든 이메일로 바꿔주세요 ↓↓↓
\set manager_email 'jeongdami@jadewater.com'

-- --------------------------------------------------------------------------
-- 지점장으로 승격 + 정다미 서울역점에 연결
--
-- 새로 만든 계정은 트리거가 자동으로 role='staff', status='pending'(가입승인
-- 대기)으로 넣는다. 지점장은 role='owner' + status='approved'여야 하고,
-- store_id가 붙어 있어야 그 매장 데이터만 보고 쓸 수 있다.
-- --------------------------------------------------------------------------
update public.profiles p
set
  role     = 'owner',
  status   = 'approved',
  store_id = s.id,
  name     = s.name
from public.stores s
where p.email = :'manager_email'
  and s.name = '정다미 서울역점';

-- --------------------------------------------------------------------------
-- 확인 — 아래 조회에서 정다미 서울역점 / owner / approved 로 나와야 합니다.
-- 한 줄도 안 나오면 1단계 계정 생성이 안 됐거나 이메일이 다른 것입니다.
-- --------------------------------------------------------------------------
select
  p.email,
  p.name,
  p.role,
  p.status,
  s.name  as store_name,
  b.name  as brand_name
from public.profiles p
left join public.stores s on s.id = p.store_id
left join public.brands b on b.id = s.brand_id
where p.email = :'manager_email';

-- --------------------------------------------------------------------------
-- 참고: 전체 계정이 어느 브랜드/매장에 붙어 있는지 한눈에 보기
-- (store_name이 비어 있으면 본사 계정 = 마스터 또는 팀 계정)
-- --------------------------------------------------------------------------
select
  p.email,
  p.name,
  p.role,
  p.status,
  coalesce(b.name, '— 본사 —') as brand_name,
  s.name                       as store_name
from public.profiles p
left join public.stores s on s.id = p.store_id
left join public.brands b on b.id = s.brand_id
order by b.sort_order nulls first, s.sort_order nulls first, p.email;
