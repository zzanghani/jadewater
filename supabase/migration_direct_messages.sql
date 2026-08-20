-- ============================================================================
-- 다이렉트메세지(1:1 DM) 기능
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 별도 "대화방" 테이블 없이, 보낸사람·받는사람 쌍으로 메시지를 저장하고
-- 화면에서 상대방 계정 기준으로 묶어서 보여준다(게시판처럼 매장/부서
-- 계정 단위로 주고받는 걸 전제로 한 가장 단순한 구조).
-- ============================================================================

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id),
  recipient_id uuid not null references public.profiles (id),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint direct_messages_not_self check (sender_id <> recipient_id)
);

alter table public.direct_messages enable row level security;

create policy "direct_messages_select_participant"
  on public.direct_messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "direct_messages_insert_own"
  on public.direct_messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

-- 읽음 처리(read_at)는 받는 사람만, 자신에게 온 메시지에 대해서만 할 수 있다.
create policy "direct_messages_update_read_by_recipient"
  on public.direct_messages for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create index if not exists direct_messages_sender_idx
  on public.direct_messages (sender_id, created_at desc);
create index if not exists direct_messages_recipient_idx
  on public.direct_messages (recipient_id, created_at desc);
create index if not exists direct_messages_unread_idx
  on public.direct_messages (recipient_id, read_at);
