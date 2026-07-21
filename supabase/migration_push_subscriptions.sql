-- ============================================================================
-- 입금요청 완료 시 매장에 푸시 알림을 보내기 위한 구독 정보 테이블
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- 매장 접근 권한이 있는 사람(마스터는 전 매장)만 조회 가능.
-- 요청완료 처리 시 마스터 계정이 해당 매장의 구독 목록을 읽어 발송해야 하므로
-- user_can_access_store를 그대로 재사용한다.
create policy "push_subscriptions_select_authenticated"
  on public.push_subscriptions for select
  to authenticated
  using (public.user_can_access_store(store_id));

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id and public.user_can_access_store(store_id));

create policy "push_subscriptions_delete_authenticated"
  on public.push_subscriptions for delete
  to authenticated
  using (public.user_can_access_store(store_id));

create index if not exists push_subscriptions_store_id_idx on public.push_subscriptions (store_id);
