-- ============================================================================
-- 채팅 사진·파일용 'chat' 스토리지 버킷 — 처음부터 다시, 전부 포함
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 확인해보니 'chat' 버킷 자체가 실제로 생성된 적이 없었다(직전
-- migration_chat_storage.sql이 어떤 이유로 끝까지 적용되지 않은 것으로
-- 보임). 여러 번 실행해도 안전하도록(이미 있으면 건너뛰거나 덮어쓰게)
-- 버킷 생성 + 필요한 권한 3개를 전부 다시 포함했다.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('chat', 'chat', false)
on conflict (id) do nothing;

drop policy if exists "chat_files_insert_authenticated" on storage.objects;
create policy "chat_files_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat');

drop policy if exists "chat_files_select_authenticated" on storage.objects;
create policy "chat_files_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chat');

drop policy if exists "chat_bucket_visible" on storage.buckets;
create policy "chat_bucket_visible"
  on storage.buckets for select
  to authenticated
  using (id = 'chat');

-- 실행 후 이 줄로 바로 확인 가능: 'chat' 행이 하나 보여야 정상.
select id, name, public from storage.buckets where id = 'chat';
