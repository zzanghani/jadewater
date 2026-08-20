-- ============================================================================
-- 채팅방 만들기가 "infinite recursion detected in policy for relation
-- chat_room_members" (42P17)로 실패하던 문제 수정
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- migration_chat_rooms_private.sql의 chat_room_members_select_own_rooms
-- 정책이, chat_room_members 자기 테이블을 서브쿼리로 다시 조회하다가
-- Postgres RLS가 그 정책을 다시 평가하려 하면서 무한 재귀에 빠졌다.
-- user_is_master()처럼 SECURITY DEFINER 함수로 그 조회를 감싸서(함수
-- 안에서는 RLS를 다시 타지 않음) 재귀를 끊는다.
-- ============================================================================

create or replace function public.is_chat_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.chat_room_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

drop policy if exists "chat_room_members_select_own_rooms" on public.chat_room_members;
create policy "chat_room_members_select_own_rooms"
  on public.chat_room_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_chat_room_member(room_id, auth.uid())
  );
