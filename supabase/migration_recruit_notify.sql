-- ============================================================================
-- 체험단 선정자 "안내 문자" — 리뷰노트 선정 반영이 끝나면 맥미니가 선정자 전원에게
-- 선정 축하 · 방문 안내 · 셀프 예약 링크를 문자(솔라피)로 보낸다.
--   recruit_applicants.notify_sent_at : 문자 보낸 시각 (있으면 다시 안 보냄)
--   recruit_applicants.notify_error   : 마지막 발송 실패 사유 (성공하면 null)
--   recruit_applicants.notify_to      : 보낸 번호의 뒷 4자리만 (전체 번호는 앱에 저장하지 않는다)
-- 전화번호 자체는 리뷰노트에서 맥미니가 보낼 때만 읽고 앱에는 남기지 않는다.
-- 여러 번 실행해도 안전합니다. migration_recruit_booking.sql 이후에 실행.
-- ============================================================================

alter table public.recruit_applicants
  add column if not exists notify_sent_at timestamptz,
  add column if not exists notify_error text,
  add column if not exists notify_to text;
