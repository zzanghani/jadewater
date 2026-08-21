-- ============================================================================
-- 채팅방에 "회사(전사)" / "매장" 구분을 추가하고, 채팅방 개설을 지점장·
-- 마스터만 가능하게 제한한다. 팀(본사) 계정과 직원(staff) 계정은 채팅방을
-- 새로 만들 수 없고, 초대받아 참여만 할 수 있다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_employee_accounts.sql이
-- 먼저 실행되어 있어야 합니다(user_is_store_manager 함수 필요).
-- ============================================================================

-- store_id가 없으면 "회사" 채팅방(전사 공용), 있으면 그 매장 전용 채팅방.
alter table public.chat_rooms add column if not exists store_id uuid references public.stores (id);

drop policy if exists "chat_rooms_insert_own" on public.chat_rooms;
create policy "chat_rooms_insert_own"
  on public.chat_rooms for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and (
      (store_id is null and public.user_is_master())
      or (store_id is not null and public.user_is_store_manager(store_id))
    )
  );
