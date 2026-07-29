-- ============================================================================
-- 본사(마스터 + 팀 계정) 이메일 도메인을 @jadewater.com → @bestmateco.com 으로 변경
--
-- Supabase 대시보드 Users 화면에는 이메일을 직접 편집하는 UI가 없어서, 인증
-- 테이블(auth.users)을 SQL로 직접 고치는 방식으로 갑니다. SQL Editor에서 이
-- 파일 전체를 그대로 실행하세요. 매장 계정(oksu/seoul/lcdc/hanam)은 대상이
-- 아니라 건드리지 않습니다.
--
-- 아이디는 그대로 두고 도메인만 바뀝니다:
--   owner@jadewater.com      → owner@bestmateco.com       (대표님/마스터)
--   yoonju@jadewater.com     → yoonju@bestmateco.com       (디자인팀)
--   kyleshim92@jadewater.com → kyleshim92@bestmateco.com   (마케팅팀)
--   gjjang7778@jadewater.com → gjjang7778@bestmateco.com   (운영팀)
--   himssen2@jadewater.com   → himssen2@bestmateco.com     (R&D팀)
-- ============================================================================

update auth.users
set email = replace(email, '@jadewater.com', '@bestmateco.com')
where email in (
  'owner@jadewater.com',
  'yoonju@jadewater.com',
  'kyleshim92@jadewater.com',
  'gjjang7778@jadewater.com',
  'himssen2@jadewater.com'
);

-- 이메일 로그인 provider가 참조하는 identity_data도 같이 맞춰준다.
update auth.identities
set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(replace(identity_data->>'email', '@jadewater.com', '@bestmateco.com')))
where identity_data->>'email' in (
  'owner@jadewater.com',
  'yoonju@jadewater.com',
  'kyleshim92@jadewater.com',
  'gjjang7778@jadewater.com',
  'himssen2@jadewater.com'
);

-- profiles 테이블의 email(참고용 캐시값, auth.users와 자동 동기화되지 않음)도 맞춘다.
update public.profiles
set email = replace(email, '@jadewater.com', '@bestmateco.com')
where email in (
  'owner@jadewater.com',
  'yoonju@jadewater.com',
  'kyleshim92@jadewater.com',
  'gjjang7778@jadewater.com',
  'himssen2@jadewater.com'
);

-- 확인
select email, name, department, store_id
from public.profiles
where email like '%@bestmateco.com'
order by department nulls first;
