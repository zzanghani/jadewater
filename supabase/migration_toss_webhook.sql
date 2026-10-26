-- ============================================================================
-- 토스플레이스 웹훅 수신.
-- - toss_settings.webhook_secret : 웹훅 서명 검증 키 (개발자센터 웹훅 생성 시 정한 값)
-- - toss_webhook_events : 받은 이벤트 전부 (x-toss-webhook-id로 중복 제거)
-- - toss_installations  : 앱이 설치된 매장(app.installation.created.v1) → 설정 화면에서 골라 연결
-- 쓰기는 서비스 키(웹훅 라우트)만, 읽기는 본사 마스터만. 여러 번 실행해도 안전합니다.
-- ============================================================================

alter table public.toss_settings add column if not exists webhook_secret text;

create table if not exists public.toss_webhook_events (
  id text primary key,
  type text not null,
  merchant_id text,
  created_at timestamptz,
  received_at timestamptz not null default now(),
  payload jsonb not null
);
alter table public.toss_webhook_events enable row level security;
create policy "toss_webhook_events_select_hq" on public.toss_webhook_events for select to authenticated using (public.user_is_hq_master());
create index if not exists toss_webhook_events_merchant_idx on public.toss_webhook_events (merchant_id, received_at desc);

create table if not exists public.toss_installations (
  merchant_id text primary key,
  merchant_name text,
  business_number text,
  installed_at timestamptz not null default now(),
  removed_at timestamptz
);
alter table public.toss_installations enable row level security;
create policy "toss_installations_select_hq" on public.toss_installations for select to authenticated using (public.user_is_hq_master());
