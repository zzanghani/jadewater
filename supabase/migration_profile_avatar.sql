-- ============================================================================
-- 프로필 사진(아바타) 등록 기능
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 게시판/달력 댓글에 이름만 표시돼서 누가 누군지 헷갈린다는 요청으로,
-- 작게 프로필 사진을 등록/표시할 수 있게 한다. 민감한 정보가 아니고 여러
-- 화면(게시판 목록·상세·댓글, 달력 댓글, 헤더)에서 자주 렌더링되므로
-- signed URL 대신 공개(public) 버킷으로 만들어 매번 서명 없이 바로 불러온다.
-- ============================================================================

alter table public.profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- SELECT 정책이 빠지면 upload()가 내부적으로 하는 기존 파일 존재 확인이
-- 막혀서 "Bucket not found"라는 헷갈리는 오류로 실패한다 (board 버킷에는
-- 이미 board_files_select_authenticated가 있어서 문제가 없었다).
create policy "avatars_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

-- storage.buckets 자체에도 RLS가 걸려 있어, 이 정책이 없으면 클라이언트가
-- "avatars" 버킷의 존재 자체를 못 본다.
create policy "avatars_bucket_visible"
  on storage.buckets for select
  to authenticated
  using (id = 'avatars');
