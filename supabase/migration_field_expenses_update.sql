-- ============================================================================
-- 현장지출을 등록 후에 수정할 수 있게 한다. 삭제 정책은 이미 있었지만
-- 화면에 버튼이 없어서 못 쓰고 있었음 — 이번에 같이 연결한다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_field_expenses.sql을
-- 먼저 실행한 뒤에 실행해야 합니다.
-- ============================================================================

drop policy if exists "field_expenses_update_authenticated" on public.field_expenses;
create policy "field_expenses_update_authenticated"
  on public.field_expenses for update
  to authenticated
  using (public.user_can_access_store(store_id))
  with check (public.user_can_access_store(store_id));
