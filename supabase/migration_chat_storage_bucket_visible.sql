-- ============================================================================
-- 채팅 사진·파일 업로드가 "Bucket not found"로 실패하는 문제 수정
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 예전 프로필 사진 업로드 때 겪었던 것과 같은 문제 — storage.buckets
-- 자체에도 RLS가 걸려 있어서, 그 버킷을 select로 볼 수 있는 정책이
-- 없으면 storage.objects 권한이 다 있어도 "버킷이 없다"고 오작동한다.
-- ============================================================================

create policy "chat_bucket_visible"
  on storage.buckets for select
  to authenticated
  using (id = 'chat');
