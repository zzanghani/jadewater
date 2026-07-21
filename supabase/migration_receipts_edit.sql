-- ============================================================================
-- 입고 내역 수정/삭제 권한 추가
-- SQL Editor에서 실행하세요.
-- ============================================================================

drop policy if exists "receipts_delete_own" on public.receipts;

drop policy if exists "receipts_update_authenticated" on public.receipts;
create policy "receipts_update_authenticated"
  on public.receipts for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "receipts_delete_authenticated" on public.receipts;
create policy "receipts_delete_authenticated"
  on public.receipts for delete
  to authenticated
  using (true);
