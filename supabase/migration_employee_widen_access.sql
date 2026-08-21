-- ============================================================================
-- 직원(staff) 권한 되돌리기: 마감입력·입고입력·현장지출·리뷰리포트는
-- 원래대로 직원도 이용할 수 있게 되돌린다. 실제로 막아야 하는 건
-- 월말정산 / 게시판(공지사항 외 카테고리) / 스케줄러 수정 세 가지뿐이다
-- (migration_employee_accounts.sql에서 너무 넓게 막았던 것을 좁힌다).
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_employee_accounts.sql을
-- 먼저 실행한 뒤에 실행해야 합니다.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 마감입력(daily_closings)
-- --------------------------------------------------------------------------
drop policy if exists "daily_closings_select_authenticated" on public.daily_closings;
create policy "daily_closings_select_authenticated"
  on public.daily_closings for select to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "daily_closings_insert_authenticated" on public.daily_closings;
create policy "daily_closings_insert_authenticated"
  on public.daily_closings for insert to authenticated
  with check (public.user_can_access_store_ops(store_id) and auth.uid() = created_by);

drop policy if exists "daily_closings_update_authenticated" on public.daily_closings;
create policy "daily_closings_update_authenticated"
  on public.daily_closings for update to authenticated
  using (public.user_can_access_store_ops(store_id))
  with check (public.user_can_access_store_ops(store_id));

-- --------------------------------------------------------------------------
-- 입고입력(receipts) + 최근 거래처 숨기기(hidden_suppliers)
-- --------------------------------------------------------------------------
drop policy if exists "receipts_select_authenticated" on public.receipts;
create policy "receipts_select_authenticated"
  on public.receipts for select to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "receipts_insert_authenticated" on public.receipts;
create policy "receipts_insert_authenticated"
  on public.receipts for insert to authenticated
  with check (public.user_can_access_store_ops(store_id) and auth.uid() = created_by);

drop policy if exists "receipts_update_authenticated" on public.receipts;
create policy "receipts_update_authenticated"
  on public.receipts for update to authenticated
  using (public.user_can_access_store_ops(store_id))
  with check (public.user_can_access_store_ops(store_id));

drop policy if exists "receipts_delete_authenticated" on public.receipts;
create policy "receipts_delete_authenticated"
  on public.receipts for delete to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "hidden_suppliers_select_authenticated" on public.hidden_suppliers;
create policy "hidden_suppliers_select_authenticated"
  on public.hidden_suppliers for select to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "hidden_suppliers_insert_authenticated" on public.hidden_suppliers;
create policy "hidden_suppliers_insert_authenticated"
  on public.hidden_suppliers for insert to authenticated
  with check (public.user_can_access_store_ops(store_id) and auth.uid() = hidden_by);

drop policy if exists "hidden_suppliers_delete_authenticated" on public.hidden_suppliers;
create policy "hidden_suppliers_delete_authenticated"
  on public.hidden_suppliers for delete to authenticated
  using (public.user_can_access_store_ops(store_id));

-- --------------------------------------------------------------------------
-- 현장지출(field_expenses)
-- --------------------------------------------------------------------------
drop policy if exists "field_expenses_select_authenticated" on public.field_expenses;
create policy "field_expenses_select_authenticated"
  on public.field_expenses for select to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "field_expenses_insert_authenticated" on public.field_expenses;
create policy "field_expenses_insert_authenticated"
  on public.field_expenses for insert to authenticated
  with check (public.user_can_access_store_ops(store_id) and auth.uid() = created_by);

drop policy if exists "field_expenses_delete_authenticated" on public.field_expenses;
create policy "field_expenses_delete_authenticated"
  on public.field_expenses for delete to authenticated
  using (public.user_can_access_store_ops(store_id));

-- --------------------------------------------------------------------------
-- 리뷰 리포트
-- --------------------------------------------------------------------------
drop policy if exists "review_platform_stats_select_authenticated" on public.review_platform_stats;
create policy "review_platform_stats_select_authenticated"
  on public.review_platform_stats for select to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "reviews_select_authenticated" on public.reviews;
create policy "reviews_select_authenticated"
  on public.reviews for select to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "review_ai_summaries_select_authenticated" on public.review_ai_summaries;
create policy "review_ai_summaries_select_authenticated"
  on public.review_ai_summaries for select to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "blog_posts_select_authenticated" on public.blog_posts;
create policy "blog_posts_select_authenticated"
  on public.blog_posts for select to authenticated
  using (public.user_can_access_store_ops(store_id));

-- 아래는 계속 지점장/마스터만 가능하게 그대로 둔다(변경 없음):
--   monthly_settlements, schedule_shifts(등록/수정/삭제), board_posts/
--   board_comments/board_attachments(공지사항 외 카테고리)
