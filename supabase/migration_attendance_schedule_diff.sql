-- ============================================================================
-- 출퇴근 기록에 스케줄 대비 지각·조퇴 정보를 붙인다.
--
-- 출근(IN)을 찍는 순간 그날 스케줄러(schedule_shifts)에서 같은 매장·같은 이름의
-- 근무를 찾아 시작 시각과 비교하고, 퇴근(OUT)은 종료 시각과 비교한다.
--   scheduled_at : 비교한 스케줄 시각 (출근=시작, 퇴근=종료). 스케줄 없으면 null
--   diff_minutes : 실제 − 예정 (분). 출근에서 +10이면 10분 지각, 퇴근에서 −20이면 20분 조퇴
--   shift_id     : 비교에 쓴 근무 행 (스케줄이 나중에 바뀌어도 당시 기준이 남는다)
-- 여러 번 실행해도 안전합니다. migration_gps_attendance.sql 이후에 실행.
-- ============================================================================

alter table public.attendance_records
  add column if not exists scheduled_at timestamptz,
  add column if not exists diff_minutes integer,
  add column if not exists shift_id uuid references public.schedule_shifts (id) on delete set null;
