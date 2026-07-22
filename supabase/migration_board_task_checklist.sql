-- ============================================================================
-- 게시판 업무 Follower(여러 명) 지정 + Order/Follower 완료 체크
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- Follower는 여러 명일 수 있어서 board_posts에 컬럼을 두지 않고 별도
-- board_post_followers 테이블로 다대다 관계를 표현한다. Order(작성자)가
-- 확인하고 Follower 전원이 확인하면 completed_at이 채워져 목록에서
-- 사라진다 (payment_requests의 completed_at 패턴과 동일).
-- ============================================================================

alter table public.board_posts
  add column if not exists requester_confirmed boolean not null default false,
  add column if not exists completed_at timestamptz;

-- 작성자 본인만 자신의 확인(requester_confirmed) 체크를 업데이트할 수 있다.
-- completed_at은 서버 로직이 재계산해서 함께 업데이트한다.
create policy "board_posts_update_own"
  on public.board_posts for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create index if not exists board_posts_completed_at_idx on public.board_posts (completed_at);

create table if not exists public.board_post_followers (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.board_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.board_post_followers enable row level security;

create policy "board_post_followers_select_authenticated"
  on public.board_post_followers for select
  to authenticated
  using (true);

-- Follower 추가는 그 글의 작성자만 할 수 있다 (글쓸 때 지정).
create policy "board_post_followers_insert_by_post_owner"
  on public.board_post_followers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.board_posts
      where id = post_id and created_by = auth.uid()
    )
  );

-- 본인의 확인 체크는 본인만 업데이트할 수 있다.
create policy "board_post_followers_update_own"
  on public.board_post_followers for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists board_post_followers_post_id_idx on public.board_post_followers (post_id);
create index if not exists board_post_followers_user_id_idx on public.board_post_followers (user_id);
