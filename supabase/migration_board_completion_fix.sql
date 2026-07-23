-- ============================================================================
-- Follower 체크로 완료되는 경우 completed_at 기록이 막히던 문제 수정
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- board_posts_update_own 정책이 "작성자 본인만 수정 가능"이라, Follower가
-- 체크박스를 눌러서 완료 조건이 채워질 때 completed_at을 기록하려는
-- 업데이트가 RLS에 막혀 조용히 실패했다. 작성자뿐 아니라 그 글의
-- Follower도 (완료 여부 기록을 위해) board_posts를 수정할 수 있게 넓힌다.
-- ============================================================================

drop policy if exists "board_posts_update_own" on public.board_posts;
create policy "board_posts_update_own"
  on public.board_posts for update
  to authenticated
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.board_post_followers
      where post_id = board_posts.id and user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = created_by
    or exists (
      select 1 from public.board_post_followers
      where post_id = board_posts.id and user_id = auth.uid()
    )
  );
