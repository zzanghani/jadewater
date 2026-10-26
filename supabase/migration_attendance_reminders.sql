-- ============================================================================
-- 출퇴근 알림 발송 기록.
-- 스케줄러에 잡힌 근무자에게 출근 2시간 전·퇴근 1시간 전 푸시를 보내는 크론
-- (/api/cron/attendance-reminders, 10분마다)이 같은 사람·같은 근무에 두 번
-- 보내지 않도록 보낸 내역을 남긴다. 서비스 키로만 쓰므로 RLS 정책은 두지 않는다.
-- 여러 번 실행해도 안전합니다.
-- ============================================================================

create table if not exists public.attendance_reminders (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.schedule_shifts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 'start' 출근 2시간 전 | 'end' 퇴근 1시간 전
  kind text not null check (kind in ('start', 'end')),
  sent_at timestamptz not null default now(),
  unique (shift_id, user_id, kind)
);

alter table public.attendance_reminders enable row level security;
