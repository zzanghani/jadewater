-- ============================================================================
-- 출퇴근 알림 4개로 변경 (2026-11-01)
-- 출근 2시간 전·퇴근 1시간 전 (kind 'start'/'end')
--   → 출근 30분 전·10분 전, 퇴근 30분 전·10분 전 (kind 'start30'/'start10'/'end30'/'end10')
-- 옛 발송 기록은 지우지 않고 허용 값만 넓힌다. 크론 주기(10분→5분)는
-- migration_attendance_reminder_cron.sql 을 다시 실행해서 바꾼다.
-- 여러 번 실행해도 안전합니다.
-- ============================================================================

alter table public.attendance_reminders drop constraint if exists attendance_reminders_kind_check;
alter table public.attendance_reminders
  add constraint attendance_reminders_kind_check
  check (kind in ('start', 'end', 'start30', 'start10', 'end30', 'end10'));
