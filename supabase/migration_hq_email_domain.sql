-- ============================================================================
-- 본사(마스터 + 팀 계정) 이메일 도메인을 @jadewater.com → @bestmateco.com 으로 변경
--
-- 순서가 중요합니다:
-- 1) Supabase 대시보드 → Authentication → Users 에서 아래 5개 계정을 각각 열어
--    이메일을 @jadewater.com → @bestmateco.com 으로 직접 수정 (아이디는 그대로,
--    도메인만 교체). 로그인 자격 증명 자체는 이 대시보드 수정이 진짜 반영되는
--    곳이라 SQL만으로는 로그인 이메일이 바뀌지 않습니다.
--      owner@jadewater.com      → owner@bestmateco.com
--      design@jadewater.com     → design@bestmateco.com
--      marketing@jadewater.com  → marketing@bestmateco.com
--      ops@jadewater.com        → ops@bestmateco.com
--      rnd@jadewater.com        → rnd@bestmateco.com
-- 2) 위 작업을 다 마친 뒤, 이 SQL을 SQL Editor에서 실행해서 profiles 테이블의
--    email 컬럼(참고용 캐시값, auth.users와 자동 동기화되지 않음)을 맞춰줍니다.
-- 3) 매장 계정(oksu/seoul/lcdc/hanam@jadewater.com)은 대상이 아닙니다 — 건드리지 않습니다.
-- ============================================================================

update public.profiles set email = 'owner@bestmateco.com' where email = 'owner@jadewater.com';
update public.profiles set email = 'design@bestmateco.com' where email = 'design@jadewater.com';
update public.profiles set email = 'marketing@bestmateco.com' where email = 'marketing@jadewater.com';
update public.profiles set email = 'ops@bestmateco.com' where email = 'ops@jadewater.com';
update public.profiles set email = 'rnd@bestmateco.com' where email = 'rnd@jadewater.com';

-- 확인
select email, name, department, store_id
from public.profiles
where email like '%@bestmateco.com'
order by department nulls first;
