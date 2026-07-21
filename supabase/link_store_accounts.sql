-- ============================================================================
-- 지점 계정 ↔ 매장 연결
-- 4개 지점 계정을 Supabase 대시보드(Authentication → Users → Add user,
-- "Auto Confirm User" 체크)로 먼저 만든 뒤 이 SQL을 실행하세요.
-- ============================================================================

update public.profiles p
set store_id = s.id, name = s.name
from public.stores s
where p.email = 'oksu@jadewater.com' and s.name = '제이드앤워터 옥수본점';

update public.profiles p
set store_id = s.id, name = s.name
from public.stores s
where p.email = 'seoul@jadewater.com' and s.name = '제이드앤워터 서울역점';

update public.profiles p
set store_id = s.id, name = s.name
from public.stores s
where p.email = 'lcdc@jadewater.com' and s.name = '제이드앤워터 성수LCDC';

update public.profiles p
set store_id = s.id, name = s.name
from public.stores s
where p.email = 'hanam@jadewater.com' and s.name = '제이드앤워터 스타필드하남';

-- 확인: 각 계정이 어느 매장에 연결됐는지 조회
select p.email, p.role, s.name as store_name
from public.profiles p
left join public.stores s on s.id = p.store_id
order by p.email;
