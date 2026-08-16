-- ============================================================================
-- 게시판 글 수정 화면에서 마스터가 Order/Follower 확인 체크를 다시 켜고 끌
-- 수 있게 하기 위한 권한 확장. Supabase 프로젝트의 SQL Editor에서 그대로
-- 실행하세요.
--
-- board_post_followers.confirmed는 지금까지 본인(Follower)만 고칠 수 있었다.
-- 수정 화면에서 마스터가 잘못 체크된 Follower 확인을 대신 바로잡을 수 있게
-- user_is_master() 조건을 추가한다.
-- ============================================================================

drop policy if exists "board_post_followers_update_own" on public.board_post_followers;
create policy "board_post_followers_update_own"
  on public.board_post_followers for update
  to authenticated
  using (auth.uid() = user_id or public.user_is_master())
  with check (auth.uid() = user_id or public.user_is_master());
