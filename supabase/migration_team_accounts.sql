-- ============================================================================
-- 본사 팀 계정 (디자이너/마케터/운영팀/R&D)
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- profiles.department가 채워진 계정은 "팀 계정"이다. store_id는 NULL로 둬서
-- 게시판/주간보고는 마스터처럼 전 매장을 보되, department가 있으면
-- user_is_master()가 false로 바뀌어 입금요청 완료 처리 같은 마스터 전용 조작이나
-- 매장 운영/재무 테이블(마감입력·입금요청·재고·스케줄러·현장지출·월말정산·
-- 리뷰리포트 등) 자체를 RLS 단계에서 원천 차단한다. 화면(UI)에서도 게시판 탭
-- 외에는 노출하지 않지만, 실제 보안 경계는 이 RLS다.
-- ============================================================================

alter table public.profiles add column if not exists department text
  check (department in ('design', 'marketing', 'ops', 'rnd'));

-- --------------------------------------------------------------------------
-- 1. user_is_master()를 department 없는 store_id-null 계정으로 한정
--    (기존: store_id is null 이면 전부 마스터 취급 → 팀 계정도 마스터 전용
--    조작 권한을 갖게 되는 문제를 막는다)
-- --------------------------------------------------------------------------
create or replace function public.user_is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and store_id is null and department is null
  );
$$;

-- --------------------------------------------------------------------------
-- 2. 매장 운영/재무 데이터 전용 접근 함수 (팀 계정은 항상 false)
-- --------------------------------------------------------------------------
create or replace function public.user_can_access_store_ops(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and department is null
      and (store_id is null or store_id = target_store_id)
  );
$$;

-- --------------------------------------------------------------------------
-- 3. daily_closings
-- --------------------------------------------------------------------------
drop policy if exists "daily_closings_select_authenticated" on public.daily_closings;
create policy "daily_closings_select_authenticated"
  on public.daily_closings for select
  to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "daily_closings_insert_authenticated" on public.daily_closings;
create policy "daily_closings_insert_authenticated"
  on public.daily_closings for insert
  to authenticated
  with check (public.user_can_access_store_ops(store_id) and auth.uid() = created_by);

drop policy if exists "daily_closings_update_authenticated" on public.daily_closings;
create policy "daily_closings_update_authenticated"
  on public.daily_closings for update
  to authenticated
  using (public.user_can_access_store_ops(store_id))
  with check (public.user_can_access_store_ops(store_id));

-- --------------------------------------------------------------------------
-- 4. payment_requests (완료 처리/수정은 이미 user_is_master()로 막혀 있어
--    2번에서 자동으로 처리됨 — 조회/등록만 여기서 추가로 막는다)
-- --------------------------------------------------------------------------
drop policy if exists "payment_requests_select_authenticated" on public.payment_requests;
create policy "payment_requests_select_authenticated"
  on public.payment_requests for select
  to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "payment_requests_insert_authenticated" on public.payment_requests;
create policy "payment_requests_insert_authenticated"
  on public.payment_requests for insert
  to authenticated
  with check (public.user_can_access_store_ops(store_id) and auth.uid() = created_by);

-- --------------------------------------------------------------------------
-- 5. receipts
-- --------------------------------------------------------------------------
drop policy if exists "receipts_select_authenticated" on public.receipts;
create policy "receipts_select_authenticated"
  on public.receipts for select
  to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "receipts_insert_authenticated" on public.receipts;
create policy "receipts_insert_authenticated"
  on public.receipts for insert
  to authenticated
  with check (public.user_can_access_store_ops(store_id) and auth.uid() = created_by);

drop policy if exists "receipts_update_authenticated" on public.receipts;
create policy "receipts_update_authenticated"
  on public.receipts for update
  to authenticated
  using (public.user_can_access_store_ops(store_id))
  with check (public.user_can_access_store_ops(store_id));

drop policy if exists "receipts_delete_authenticated" on public.receipts;
create policy "receipts_delete_authenticated"
  on public.receipts for delete
  to authenticated
  using (public.user_can_access_store_ops(store_id));

-- --------------------------------------------------------------------------
-- 6. monthly_settlements (월말정산 — 이번 요청의 핵심)
-- --------------------------------------------------------------------------
drop policy if exists "monthly_settlements_select_authenticated" on public.monthly_settlements;
create policy "monthly_settlements_select_authenticated"
  on public.monthly_settlements for select
  to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "monthly_settlements_insert_authenticated" on public.monthly_settlements;
create policy "monthly_settlements_insert_authenticated"
  on public.monthly_settlements for insert
  to authenticated
  with check (public.user_can_access_store_ops(store_id) and auth.uid() = created_by);

drop policy if exists "monthly_settlements_update_authenticated" on public.monthly_settlements;
create policy "monthly_settlements_update_authenticated"
  on public.monthly_settlements for update
  to authenticated
  using (public.user_can_access_store_ops(store_id))
  with check (public.user_can_access_store_ops(store_id));

-- --------------------------------------------------------------------------
-- 7. field_expenses (현장지출)
-- --------------------------------------------------------------------------
drop policy if exists "field_expenses_select_authenticated" on public.field_expenses;
create policy "field_expenses_select_authenticated"
  on public.field_expenses for select
  to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "field_expenses_insert_authenticated" on public.field_expenses;
create policy "field_expenses_insert_authenticated"
  on public.field_expenses for insert
  to authenticated
  with check (public.user_can_access_store_ops(store_id) and auth.uid() = created_by);

drop policy if exists "field_expenses_delete_authenticated" on public.field_expenses;
create policy "field_expenses_delete_authenticated"
  on public.field_expenses for delete
  to authenticated
  using (public.user_can_access_store_ops(store_id));

-- receipts 스토리지 버킷(영수증 사진)도 동일하게 막는다
drop policy if exists "receipts_insert_authenticated" on storage.objects;
create policy "receipts_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and public.user_can_access_store_ops((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "receipts_select_authenticated" on storage.objects;
create policy "receipts_select_authenticated"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and public.user_can_access_store_ops((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "receipts_delete_authenticated" on storage.objects;
create policy "receipts_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and public.user_can_access_store_ops((storage.foldername(name))[1]::uuid)
  );

-- --------------------------------------------------------------------------
-- 8. schedule_shifts (스케줄러)
-- --------------------------------------------------------------------------
drop policy if exists "schedule_shifts_select_authenticated" on public.schedule_shifts;
create policy "schedule_shifts_select_authenticated"
  on public.schedule_shifts for select
  to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "schedule_shifts_insert_authenticated" on public.schedule_shifts;
create policy "schedule_shifts_insert_authenticated"
  on public.schedule_shifts for insert
  to authenticated
  with check (public.user_can_access_store_ops(store_id) and auth.uid() = created_by);

drop policy if exists "schedule_shifts_update_authenticated" on public.schedule_shifts;
create policy "schedule_shifts_update_authenticated"
  on public.schedule_shifts for update
  to authenticated
  using (public.user_can_access_store_ops(store_id))
  with check (public.user_can_access_store_ops(store_id));

drop policy if exists "schedule_shifts_delete_authenticated" on public.schedule_shifts;
create policy "schedule_shifts_delete_authenticated"
  on public.schedule_shifts for delete
  to authenticated
  using (public.user_can_access_store_ops(store_id));

-- --------------------------------------------------------------------------
-- 9. inventory_items / inventory_counts (재고관리)
-- --------------------------------------------------------------------------
drop policy if exists "inventory_items_select_authenticated" on public.inventory_items;
create policy "inventory_items_select_authenticated"
  on public.inventory_items for select
  to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "inventory_items_insert_authenticated" on public.inventory_items;
create policy "inventory_items_insert_authenticated"
  on public.inventory_items for insert
  to authenticated
  with check (public.user_can_access_store_ops(store_id) and auth.uid() = created_by);

drop policy if exists "inventory_items_update_authenticated" on public.inventory_items;
create policy "inventory_items_update_authenticated"
  on public.inventory_items for update
  to authenticated
  using (public.user_can_access_store_ops(store_id))
  with check (public.user_can_access_store_ops(store_id));

drop policy if exists "inventory_items_delete_authenticated" on public.inventory_items;
create policy "inventory_items_delete_authenticated"
  on public.inventory_items for delete
  to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "inventory_counts_select_authenticated" on public.inventory_counts;
create policy "inventory_counts_select_authenticated"
  on public.inventory_counts for select
  to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "inventory_counts_insert_authenticated" on public.inventory_counts;
create policy "inventory_counts_insert_authenticated"
  on public.inventory_counts for insert
  to authenticated
  with check (public.user_can_access_store_ops(store_id) and auth.uid() = created_by);

drop policy if exists "inventory_counts_update_authenticated" on public.inventory_counts;
create policy "inventory_counts_update_authenticated"
  on public.inventory_counts for update
  to authenticated
  using (public.user_can_access_store_ops(store_id))
  with check (public.user_can_access_store_ops(store_id));

-- --------------------------------------------------------------------------
-- 10. 리뷰 리포트 / 블로그 후기 — 요청 범위(게시판·주간보고)를 넘어서므로
--     팀 계정에는 우선 노출하지 않는다
-- --------------------------------------------------------------------------
drop policy if exists "review_platform_stats_select_authenticated" on public.review_platform_stats;
create policy "review_platform_stats_select_authenticated"
  on public.review_platform_stats for select
  to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "reviews_select_authenticated" on public.reviews;
create policy "reviews_select_authenticated"
  on public.reviews for select
  to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "review_ai_summaries_select_authenticated" on public.review_ai_summaries;
create policy "review_ai_summaries_select_authenticated"
  on public.review_ai_summaries for select
  to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "blog_posts_select_authenticated" on public.blog_posts;
create policy "blog_posts_select_authenticated"
  on public.blog_posts for select
  to authenticated
  using (public.user_can_access_store_ops(store_id));

-- --------------------------------------------------------------------------
-- 확인: department별 계정 목록
-- --------------------------------------------------------------------------
select email, name, department, store_id from public.profiles where department is not null;
