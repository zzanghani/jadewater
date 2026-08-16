-- ============================================================================
-- 게시판 글 수정 화면에서 마스터가 Follower를 추가/제거할 수 있게 하기
-- 위한 권한 확장. Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- Follower 추가(insert)는 지금까지 그 글의 작성자만 할 수 있었다. 마스터가
-- 다른 사람이 쓴 글을 수정하면서 Follower를 새로 넣을 수 있게
-- user_is_master() 조건을 추가한다. Follower 제거(delete)는 이미
-- migration_board_archive.sql에서 마스터에게 허용되어 있다.
-- ============================================================================

drop policy if exists "board_post_followers_insert_by_post_owner" on public.board_post_followers;
create policy "board_post_followers_insert_by_post_owner"
  on public.board_post_followers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.board_posts
      where id = post_id and created_by = auth.uid()
    )
    or public.user_is_master()
  );
