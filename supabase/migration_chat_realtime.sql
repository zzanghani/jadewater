-- ============================================================================
-- 채팅방 메시지 실시간 반영을 위한 Realtime 활성화
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 기본적으로 테이블은 Realtime 구독 대상이 아니라서, chat_messages를
-- supabase_realtime publication에 넣어줘야 새 메시지가 새로고침 없이
-- 화면에 바로 뜬다. RLS(chat_messages_select_member)는 그대로 적용되어
-- 그 방 참여자에게만 실시간으로 전달된다.
-- ============================================================================

alter publication supabase_realtime add table public.chat_messages;
