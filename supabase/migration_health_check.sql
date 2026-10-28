-- ============================================================================
-- 앱 자동 점검(헬스체크) — DB 쪽 스냅샷 함수 + 하루 1회 pg_cron 호출.
--
-- 앱의 /api/cron/health 라우트가 서비스 키로 public.health_snapshot()을 불러
-- RLS 꺼진 테이블, pg_cron 실패, pg_net 호출 실패 같은 DB 상태를 받아 가고,
-- 이상이 있으면 대표(owner) 계정 폰으로 웹푸시를 보낸다.
--
-- pg_cron은 매일 KST 12:00(UTC 03:00)에 같은 라우트를 한 번 더 불러서
-- 아침 루틴이 못 돌았을 때도 이상이 있으면 알림이 가게 한다.
-- 호출 주소는 Vault의 health_cron_url, 없으면 attendance_cron_url에서
-- 경로만 바꿔 쓴다. 토큰은 attendance 크론과 같은 Vault cron_secret.
-- 여러 번 실행해도 안전합니다 (create or replace / cron.schedule 은 같은 이름이면 갱신).
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.health_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'checked_at', now(),
    -- RLS가 꺼진 public 테이블 (있으면 안 됨)
    'rls_off_tables', (
      select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    ),
    -- pg_cron 잡별 마지막 실행 결과
    'cron_jobs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', j.jobname,
        'active', j.active,
        'schedule', j.schedule,
        'last_status', d.status,
        'last_run', d.start_time,
        'message', left(d.return_message, 200)
      ) order by j.jobname), '[]'::jsonb)
      from cron.job j
      left join lateral (
        select status, start_time, return_message
        from cron.job_run_details r
        where r.jobid = j.jobid
        order by start_time desc
        limit 1
      ) d on true
    ),
    'cron_failures_24h', (
      select count(*) from cron.job_run_details
      where start_time > now() - interval '24 hours' and status <> 'succeeded'
    ),
    -- pg_net 으로 앱을 부른 결과 중 실패(4xx/5xx/타임아웃)
    'http_failures_24h', (
      select count(*) from net._http_response
      where created > now() - interval '24 hours'
        and (status_code is null or status_code >= 400)
    ),
    'http_last_error', (
      select left(coalesce(error_msg, content::text), 200)
      from net._http_response
      where created > now() - interval '24 hours'
        and (status_code is null or status_code >= 400)
      order by created desc
      limit 1
    ),
    'db_size_mb', round(pg_database_size(current_database()) / 1024.0 / 1024.0)
  );
$$;

revoke all on function public.health_snapshot() from public;
revoke all on function public.health_snapshot() from anon;
revoke all on function public.health_snapshot() from authenticated;
grant execute on function public.health_snapshot() to service_role;

-- 매일 KST 12:00 (UTC 03:00) 점심 점검 — 이상이 있을 때만 푸시(notify=problems).
select cron.schedule(
  'health-check',
  '0 3 * * *',
  $$
  select net.http_get(
    url := coalesce(
      (select decrypted_secret from vault.decrypted_secrets where name = 'health_cron_url'),
      replace(
        (select decrypted_secret from vault.decrypted_secrets where name = 'attendance_cron_url'),
        '/api/cron/attendance-reminders', '/api/cron/health'
      )
    ) || '?notify=problems',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 25000
  );
  $$
);
