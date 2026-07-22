-- ============================================================================
-- 사내 게시판(미니 슬랙): 게시글 + 댓글(1단계 스레드) + 파일/사진 첨부
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 매장 간 소통용이라 매장 접근제어(user_can_access_store)를 쓰지 않고,
-- 로그인한 모든 사용자(마스터+전 매장)에게 공개된 게시판으로 설계한다.
-- ============================================================================

create table if not exists public.board_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.board_posts enable row level security;

create policy "board_posts_select_authenticated"
  on public.board_posts for select
  to authenticated
  using (true);

create policy "board_posts_insert_own"
  on public.board_posts for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "board_posts_delete_own"
  on public.board_posts for delete
  to authenticated
  using (auth.uid() = created_by);

create index if not exists board_posts_created_at_idx on public.board_posts (created_at desc);

create table if not exists public.board_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.board_posts (id) on delete cascade,
  body text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.board_comments enable row level security;

create policy "board_comments_select_authenticated"
  on public.board_comments for select
  to authenticated
  using (true);

create policy "board_comments_insert_own"
  on public.board_comments for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "board_comments_delete_own"
  on public.board_comments for delete
  to authenticated
  using (auth.uid() = created_by);

create index if not exists board_comments_post_id_idx on public.board_comments (post_id, created_at);

-- 첨부파일은 게시글 또는 댓글 중 정확히 하나에만 달린다.
create table if not exists public.board_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.board_posts (id) on delete cascade,
  comment_id uuid references public.board_comments (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint board_attachments_target_check check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  )
);

alter table public.board_attachments enable row level security;

create policy "board_attachments_select_authenticated"
  on public.board_attachments for select
  to authenticated
  using (true);

create policy "board_attachments_insert_own"
  on public.board_attachments for insert
  to authenticated
  with check (auth.uid() = created_by);

create index if not exists board_attachments_post_id_idx on public.board_attachments (post_id);
create index if not exists board_attachments_comment_id_idx on public.board_attachments (comment_id);

insert into storage.buckets (id, name, public)
values ('board', 'board', false)
on conflict (id) do nothing;

create policy "board_files_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'board');

create policy "board_files_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'board');

-- 댓글이 달리면 게시글 작성자에게 push 알림을 보내야 하는데, 작성자가
-- 다른 매장 소속이면 push_subscriptions SELECT 정책(매장 접근제어)에
-- 막혀서 댓글 단 사람이 그 구독 목록을 읽을 수 없다. 그래서 대상 user_id의
-- 구독만 반환하는 SECURITY DEFINER 함수로 우회한다.
create or replace function public.get_push_subscriptions_for_user(p_user_id uuid)
returns setof public.push_subscriptions
language sql
security definer
set search_path = public
as $$
  select * from public.push_subscriptions where user_id = p_user_id;
$$;

grant execute on function public.get_push_subscriptions_for_user(uuid) to authenticated;
