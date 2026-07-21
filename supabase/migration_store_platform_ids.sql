-- ============================================================================
-- stores에 리뷰 자동수집용 플랫폼별 매장 ID 컬럼 추가
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

alter table public.stores
  add column if not exists google_place_id text,
  add column if not exists naver_place_id text,
  add column if not exists kakao_place_id text;

update public.stores set
  google_place_id = 'ChIJRwdZmgmjfDUREo58YuEpLf8',
  naver_place_id = '1012333241',
  kakao_place_id = '201349608'
where name = '제이드앤워터 옥수본점';

update public.stores set
  google_place_id = 'ChIJyeBUDACjfDURpRRHV-Oajcs',
  naver_place_id = '1701681435',
  kakao_place_id = '1663023691'
where name = '제이드앤워터 서울역점';

update public.stores set
  google_place_id = 'ChIJg9d5SA6lfDURHLofXrJV_SA',
  naver_place_id = '2020121493',
  kakao_place_id = '803375233'
where name = '제이드앤워터 성수LCDC';

update public.stores set
  google_place_id = 'ChIJ2_K4cWqzfDURsi1YFAet1wM',
  naver_place_id = '2049545198',
  kakao_place_id = '532722941'
where name = '제이드앤워터 스타필드하남';
