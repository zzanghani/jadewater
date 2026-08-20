-- ============================================================================
-- 채팅방(1:1 메시지 + 자유 채팅방)에 사진·파일 첨부를 위한 스토리지 버킷
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 게시판의 'board' 버킷과 같은 패턴 — 버킷 단위로만 막고, 실제 접근은
-- 경로(UUID라 추측 불가능)를 아는 사람만 가능하다는 전제다.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('chat', 'chat', false)
on conflict (id) do nothing;

create policy "chat_files_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat');

create policy "chat_files_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chat');
