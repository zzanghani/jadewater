-- ============================================================================
-- 정다미 서울역점 지점장 계정 연결
--
-- 순서:
--  1) Supabase 대시보드 → Authentication → Users → Add user
--     - Email: 아래 update문의 이메일과 똑같이
--     - Password: 원하는 비밀번호
--     - "Auto Confirm User" 체크 (안 하면 로그인이 막힙니다)
--  2) 이 파일 전체를 SQL Editor에 붙여넣고 실행
--
-- 바꿀 곳은 아래 update문의 이메일 한 군데뿐입니다.
--
-- 주의: migration_brands.sql을 먼저 실행한 뒤에 돌려야 합니다.
--       (정다미 서울역점 매장이 그 마이그레이션에서 만들어집니다)
-- ============================================================================

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
where p.email = 'test@jdm.com'          -- ← 1단계에서 만든 이메일로 바꾸세요
  and s.name = '정다미 서울역점';

-- --------------------------------------------------------------------------
-- 확인 — 전체 계정이 어느 브랜드/매장에 붙어 있는지 한눈에 보기.
-- 방금 만든 계정이 "정다미 / 정다미 서울역점 / owner / approved"로 나오면 성공.
-- 목록에 아예 없으면 1단계 계정 생성이 안 된 것이고,
-- 있는데 store_name이 비어 있으면 위 update의 이메일이 틀린 것입니다.
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
