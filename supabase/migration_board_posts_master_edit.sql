-- ============================================================================
-- 게시글 수정 권한을 마스터 계정 전체로 확장 (공지사항 수정 기능용)
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 기존 board_posts_update_own 정책은 "작성자 본인 또는 Follower"만 수정
-- 가능해서, 마스터가 다른 사람이 쓴 공지사항을 고칠 수 없었다. 마스터
-- 계정은 작성자와 무관하게 항상 수정할 수 있게 조건을 추가한다.
-- ============================================================================

drop policy if exists "board_posts_update_own" on public.board_posts;
create policy "board_posts_update_own"
  on public.board_posts for update
  to authenticated
  using (
    auth.uid() = created_by
    or public.user_is_master()
    or exists (
      select 1 from public.board_post_followers
      where post_id = board_posts.id and user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = created_by
    or public.user_is_master()
    or exists (
      select 1 from public.board_post_followers
      where post_id = board_posts.id and user_id = auth.uid()
    )
  );
