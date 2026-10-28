-- ============================================================================
-- 체험단 선정자 "셀프 방문 예약" — 점장이 회차의 예약 링크(/visit/<토큰>)를
-- 리뷰노트 안내문에 넣어두면, 선정된 블로거가 직접 날짜·시간·인원을 적는다.
--   recruit_rounds.booking_token   : 회차별 공개 링크 토큰(추측 불가). 로그인 없이 쓰므로
--                                    페이지는 선정 명단을 보여주지 않고, 입력한 블로그가
--                                    선정자여야만 저장한다.
--   recruit_applicants.visit_source : 'manager'(점장 입력) | 'reviewer'(본인 입력)
--   recruit_applicants.visit_contact: 본인이 남긴 연락처(선택)
--   recruit_applicants.visit_updated_at
-- 여러 번 실행해도 안전합니다. migration_recruit_visits.sql 이후에 실행.
-- ============================================================================

alter table public.recruit_rounds
  add column if not exists booking_token text not null default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists recruit_rounds_booking_token_uidx on public.recruit_rounds (booking_token);

alter table public.recruit_applicants
  add column if not exists visit_source text,
  add column if not exists visit_contact text,
  add column if not exists visit_updated_at timestamptz;
