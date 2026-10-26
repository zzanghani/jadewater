-- ============================================================================
-- 출퇴근 알림 크론 (10분마다) — Supabase pg_cron + pg_net.
--
-- Vercel Hobby 플랜은 크론을 하루 1회만 허용해서, 10분 주기는 DB 쪽 스케줄러로 돈다.
-- pg_cron이 10분마다 앱의 /api/cron/attendance-reminders 를 호출하고,
-- 그 라우트가 스케줄 근무자에게 출근 2시간 전·퇴근 1시간 전 푸시를 보낸다.
--
-- 호출 주소와 인증 토큰은 코드에 안 남기고 Vault에 둔다 (환경마다 다름):
--   select vault.create_secret('https://<앱주소>/api/cron/attendance-reminders', 'attendance_cron_url');
--   select vault.create_secret('<CRON_SECRET 값>', 'cron_secret');
-- (Vercel 환경변수 CRON_SECRET과 같은 값이어야 한다.)
-- 여러 번 실행해도 안전합니다.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 같은 이름의 기존 잡이 있으면 지우고 다시 건다.
select cron.unschedule(jobid) from cron.job where jobname = 'attendance-reminders';

select cron.schedule(
  'attendance-reminders',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'attendance_cron_url'),
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 20000
  );
  $$
);
