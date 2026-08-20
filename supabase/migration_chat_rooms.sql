-- ============================================================================
-- 자유 채팅방(그룹 채팅) 기능
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 누구나 이름을 정해서 방을 만들 수 있고, 만들어진 방은 게시판처럼 전
-- 계정에 공개되어 누구나 들어와서 보고 대화할 수 있다. chat_room_members는
-- "누가 볼 수 있는지"를 가르는 권한이 아니라, 각자 언제까지 읽었는지
-- (last_read_at)를 기록해서 안읽음 표시를 하기 위한 용도일 뿐이다.
-- ============================================================================

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.chat_rooms enable row level security;

create policy "chat_rooms_select_authenticated"
  on public.chat_rooms for select
  to authenticated
  using (true);

create policy "chat_rooms_insert_own"
  on public.chat_rooms for insert
  to authenticated
  with check (auth.uid() = created_by);

create table if not exists public.chat_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

alter table public.chat_room_members enable row level security;

create policy "chat_room_members_select_authenticated"
  on public.chat_room_members for select
  to authenticated
  using (true);

create policy "chat_room_members_insert_own"
  on public.chat_room_members for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "chat_room_members_update_own"
  on public.chat_room_members for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "chat_messages_select_authenticated"
  on public.chat_messages for select
  to authenticated
  using (true);

create policy "chat_messages_insert_own"
  on public.chat_messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

create index if not exists chat_room_members_room_idx on public.chat_room_members (room_id);
create index if not exists chat_room_members_user_idx on public.chat_room_members (user_id);
create index if not exists chat_messages_room_idx on public.chat_messages (room_id, created_at);
