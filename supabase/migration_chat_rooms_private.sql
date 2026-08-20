-- ============================================================================
-- 채팅방을 "전 계정 공개"에서 "초대된 사람만" 볼 수 있게 변경
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- migration_chat_rooms.sql은 게시판처럼 전 계정이 자유롭게 보고 참여할
-- 수 있는 구조였는데, 실제로는 초대된 사람만 봐야 한다는 요청이 있어서
-- chat_room_members(참여자 기록)를 진짜 접근 권한으로 승격시킨다.
-- ============================================================================

drop policy if exists "chat_rooms_select_authenticated" on public.chat_rooms;
create policy "chat_rooms_select_member"
  on public.chat_rooms for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_room_members
      where room_id = chat_rooms.id and user_id = auth.uid()
    )
  );

drop policy if exists "chat_room_members_select_authenticated" on public.chat_room_members;
create policy "chat_room_members_select_own_rooms"
  on public.chat_room_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.chat_room_members m2
      where m2.room_id = chat_room_members.room_id and m2.user_id = auth.uid()
    )
  );

-- 참여자 추가(초대)는 방을 만든 사람만 할 수 있고(개설 시 초대),
-- 본인을 스스로 추가하는 것도 여전히 허용한다(방 만든 사람 자신의
-- 최초 참여 기록용).
drop policy if exists "chat_room_members_insert_own" on public.chat_room_members;
create policy "chat_room_members_insert_by_creator_or_self"
  on public.chat_room_members for insert
  to authenticated
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.chat_rooms
      where id = room_id and created_by = auth.uid()
    )
  );

drop policy if exists "chat_messages_select_authenticated" on public.chat_messages;
create policy "chat_messages_select_member"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_room_members
      where room_id = chat_messages.room_id and user_id = auth.uid()
    )
  );

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_member"
  on public.chat_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.chat_room_members
      where room_id = chat_messages.room_id and user_id = auth.uid()
    )
  );
