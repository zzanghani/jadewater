-- ============================================================================
-- 게시판 완료글 구글드라이브 보관 기능을 위한 권한 확장
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 마스터가 완료된 글을 구글드라이브로 옮긴 뒤 Supabase에서 지우려면,
-- 본인이 쓰지 않은 글/댓글/첨부파일도 삭제할 수 있어야 한다(마스터는 이미
-- user_is_master()로 전 매장 데이터에 접근 가능한 역할이라 자연스러운 확장).
-- board_posts를 지우면 on delete cascade로 댓글/첨부/팔로워도 같이 지워지는데,
-- 그 cascade 삭제도 각 테이블의 DELETE 정책을 통과해야 하므로 다 같이 손봐야 한다.
-- ============================================================================

drop policy if exists "board_posts_delete_own" on public.board_posts;
create policy "board_posts_delete_own"
  on public.board_posts for delete
  to authenticated
  using (auth.uid() = created_by or public.user_is_master());

drop policy if exists "board_comments_delete_own" on public.board_comments;
create policy "board_comments_delete_own"
  on public.board_comments for delete
  to authenticated
  using (auth.uid() = created_by or public.user_is_master());

drop policy if exists "board_attachments_delete_authenticated" on public.board_attachments;
create policy "board_attachments_delete_authenticated"
  on public.board_attachments for delete
  to authenticated
  using (auth.uid() = created_by or public.user_is_master());

drop policy if exists "board_post_followers_delete_master" on public.board_post_followers;
create policy "board_post_followers_delete_master"
  on public.board_post_followers for delete
  to authenticated
  using (public.user_is_master());

drop policy if exists "board_files_delete_authenticated" on storage.objects;
create policy "board_files_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'board');
