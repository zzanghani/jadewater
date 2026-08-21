-- ============================================================================
-- 직원(스태프) 계정: 회원가입 → 마스터 승인 대기 → 승인 후 첫 로그인 때
-- 소속 매장 선택 → 제한된 화면만 이용하는 흐름을 위한 스키마 변경.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다.
--
-- 기존 지점 계정(oksu@/hanam@/seoul@/lcdc@ 등, 지금 지점장이 쓰고 있는
-- 계정)은 이 마이그레이션으로 자동으로 "지점장(owner)"으로 승격되어
-- 지금 쓰는 기능 그대로 유지됩니다. 그 외 모든 기존 계정(마스터/팀
-- 계정)은 status가 자동으로 'approved'로 채워져 영향이 없습니다.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. profiles.status — 회원가입 승인 대기 상태. 기존 계정은 전부 승인됨으로 시작.
-- --------------------------------------------------------------------------
alter table public.profiles add column if not exists status text not null default 'approved'
  check (status in ('pending', 'approved', 'rejected'));

-- 지금 있는 마스터/지점장 계정(팀 계정 제외)은 전부 owner로 승격 —
-- 새로 만드는 "직원" role(staff)과 명확히 구분해서, role='staff'는
-- 앞으로 자기가입한 신규 직원 계정만을 뜻하게 한다. 이렇게 안 하면
-- store_id가 아직 없는(=매장 선택 전) 신규 승인 직원과, store_id가
-- 원래 없는 마스터 계정을 구분할 방법이 없어진다.
update public.profiles
set role = 'owner'
where department is null and role = 'staff';

-- --------------------------------------------------------------------------
-- 2. 신규 가입 트리거: 항상 staff / pending으로 생성. 소속 매장은 승인 후
--    본인이 첫 로그인 때 직접 고른다(마스터가 지정하지 않음).
-- --------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'staff',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- 3. 마스터가 대기 중인 다른 사람의 profiles row를 승인/거절 처리할 수 있게 허용
-- --------------------------------------------------------------------------
drop policy if exists "profiles_update_master" on public.profiles;
create policy "profiles_update_master"
  on public.profiles for update
  to authenticated
  using (public.user_is_master())
  with check (public.user_is_master());

-- --------------------------------------------------------------------------
-- 4. 승인된 직원이 "처음 한 번"만 자기 소속 매장을 스스로 고를 수 있게 허용.
--    그 외의 자기 자신에 대한 store_id/role/status 변경(=권한 상승·자기
--    승인 시도)은 계속 막는다. status는 마스터의 승인 처리(profiles_
--    update_master)를 통해서만 바뀔 수 있어야 하므로 자기 자신은 절대
--    못 바꾸게 막는다.
-- --------------------------------------------------------------------------
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.id = auth.uid() then
    if old.store_id is null and old.role = 'staff' and old.status = 'approved' and new.role = 'staff' then
      -- 승인된 직원의 최초 매장 선택 — store_id 변경만 허용
      null;
    else
      new.store_id := old.store_id;
    end if;
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- 5. 지점장(owner)·마스터만 허용하는 매장 운영 함수 (직원 role은 제외).
--    기존 user_can_access_store_ops()는 "조회"에 계속 쓰고(직원도 조회는
--    필요한 화면이 있음), 아래 함수는 직원에게 아예 막고 싶은 화면/조작에 쓴다.
-- --------------------------------------------------------------------------
create or replace function public.user_is_store_manager(target_store_id uuid)
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
      and (
        store_id is null
        or (store_id = target_store_id and role = 'owner')
      )
  );
$$;

-- 게시판 등에서 "직원(staff) 계정인지" 자체를 확인할 때 쓰는 함수.
create or replace function public.user_is_store_staff()
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
      and store_id is not null
      and role = 'staff'
  );
$$;

-- --------------------------------------------------------------------------
-- 6. 월말정산 — 직원 완전 차단 (지점장/마스터만)
-- --------------------------------------------------------------------------
drop policy if exists "monthly_settlements_select_authenticated" on public.monthly_settlements;
create policy "monthly_settlements_select_authenticated"
  on public.monthly_settlements for select to authenticated
  using (public.user_is_store_manager(store_id));

drop policy if exists "monthly_settlements_insert_authenticated" on public.monthly_settlements;
create policy "monthly_settlements_insert_authenticated"
  on public.monthly_settlements for insert to authenticated
  with check (public.user_is_store_manager(store_id) and auth.uid() = created_by);

drop policy if exists "monthly_settlements_update_authenticated" on public.monthly_settlements;
create policy "monthly_settlements_update_authenticated"
  on public.monthly_settlements for update to authenticated
  using (public.user_is_store_manager(store_id))
  with check (public.user_is_store_manager(store_id));

-- --------------------------------------------------------------------------
-- 7. 마감입력(daily_closings) — 직원 차단
-- --------------------------------------------------------------------------
drop policy if exists "daily_closings_select_authenticated" on public.daily_closings;
create policy "daily_closings_select_authenticated"
  on public.daily_closings for select to authenticated
  using (public.user_is_store_manager(store_id));

drop policy if exists "daily_closings_insert_authenticated" on public.daily_closings;
create policy "daily_closings_insert_authenticated"
  on public.daily_closings for insert to authenticated
  with check (public.user_is_store_manager(store_id) and auth.uid() = created_by);

drop policy if exists "daily_closings_update_authenticated" on public.daily_closings;
create policy "daily_closings_update_authenticated"
  on public.daily_closings for update to authenticated
  using (public.user_is_store_manager(store_id))
  with check (public.user_is_store_manager(store_id));

-- --------------------------------------------------------------------------
-- 8. 입고입력(receipts) — 직원 차단 (하단메뉴 "재고관리"[inventory]와는 다른 화면)
-- --------------------------------------------------------------------------
drop policy if exists "receipts_select_authenticated" on public.receipts;
create policy "receipts_select_authenticated"
  on public.receipts for select to authenticated
  using (public.user_is_store_manager(store_id));

drop policy if exists "receipts_insert_authenticated" on public.receipts;
create policy "receipts_insert_authenticated"
  on public.receipts for insert to authenticated
  with check (public.user_is_store_manager(store_id) and auth.uid() = created_by);

drop policy if exists "receipts_update_authenticated" on public.receipts;
create policy "receipts_update_authenticated"
  on public.receipts for update to authenticated
  using (public.user_is_store_manager(store_id))
  with check (public.user_is_store_manager(store_id));

drop policy if exists "receipts_delete_authenticated" on public.receipts;
create policy "receipts_delete_authenticated"
  on public.receipts for delete to authenticated
  using (public.user_is_store_manager(store_id));

drop policy if exists "hidden_suppliers_select_authenticated" on public.hidden_suppliers;
create policy "hidden_suppliers_select_authenticated"
  on public.hidden_suppliers for select to authenticated
  using (public.user_is_store_manager(store_id));

drop policy if exists "hidden_suppliers_insert_authenticated" on public.hidden_suppliers;
create policy "hidden_suppliers_insert_authenticated"
  on public.hidden_suppliers for insert to authenticated
  with check (public.user_is_store_manager(store_id) and auth.uid() = hidden_by);

drop policy if exists "hidden_suppliers_delete_authenticated" on public.hidden_suppliers;
create policy "hidden_suppliers_delete_authenticated"
  on public.hidden_suppliers for delete to authenticated
  using (public.user_is_store_manager(store_id));

-- --------------------------------------------------------------------------
-- 9. 현장지출(field_expenses) — 직원 차단
-- --------------------------------------------------------------------------
drop policy if exists "field_expenses_select_authenticated" on public.field_expenses;
create policy "field_expenses_select_authenticated"
  on public.field_expenses for select to authenticated
  using (public.user_is_store_manager(store_id));

drop policy if exists "field_expenses_insert_authenticated" on public.field_expenses;
create policy "field_expenses_insert_authenticated"
  on public.field_expenses for insert to authenticated
  with check (public.user_is_store_manager(store_id) and auth.uid() = created_by);

drop policy if exists "field_expenses_delete_authenticated" on public.field_expenses;
create policy "field_expenses_delete_authenticated"
  on public.field_expenses for delete to authenticated
  using (public.user_is_store_manager(store_id));

-- --------------------------------------------------------------------------
-- 10. 스케줄러(schedule_shifts) — 직원은 "조회만" 가능, 등록/수정/삭제는
--     지점장·마스터만.
-- --------------------------------------------------------------------------
drop policy if exists "schedule_shifts_select_authenticated" on public.schedule_shifts;
create policy "schedule_shifts_select_authenticated"
  on public.schedule_shifts for select to authenticated
  using (public.user_can_access_store_ops(store_id));

drop policy if exists "schedule_shifts_insert_authenticated" on public.schedule_shifts;
create policy "schedule_shifts_insert_authenticated"
  on public.schedule_shifts for insert to authenticated
  with check (public.user_is_store_manager(store_id) and auth.uid() = created_by);

drop policy if exists "schedule_shifts_update_authenticated" on public.schedule_shifts;
create policy "schedule_shifts_update_authenticated"
  on public.schedule_shifts for update to authenticated
  using (public.user_is_store_manager(store_id))
  with check (public.user_is_store_manager(store_id));

drop policy if exists "schedule_shifts_delete_authenticated" on public.schedule_shifts;
create policy "schedule_shifts_delete_authenticated"
  on public.schedule_shifts for delete to authenticated
  using (public.user_is_store_manager(store_id));

-- --------------------------------------------------------------------------
-- 11. 리뷰 리포트 — 직원 차단 (지점장/마스터만)
-- --------------------------------------------------------------------------
drop policy if exists "review_platform_stats_select_authenticated" on public.review_platform_stats;
create policy "review_platform_stats_select_authenticated"
  on public.review_platform_stats for select to authenticated
  using (public.user_is_store_manager(store_id));

drop policy if exists "reviews_select_authenticated" on public.reviews;
create policy "reviews_select_authenticated"
  on public.reviews for select to authenticated
  using (public.user_is_store_manager(store_id));

drop policy if exists "review_ai_summaries_select_authenticated" on public.review_ai_summaries;
create policy "review_ai_summaries_select_authenticated"
  on public.review_ai_summaries for select to authenticated
  using (public.user_is_store_manager(store_id));

drop policy if exists "blog_posts_select_authenticated" on public.blog_posts;
create policy "blog_posts_select_authenticated"
  on public.blog_posts for select to authenticated
  using (public.user_is_store_manager(store_id));

-- --------------------------------------------------------------------------
-- 12. 게시판 — 직원은 "공지사항" 카테고리만 조회 가능, 글 작성은 아예 불가
--     (공지사항 작성은 원래 마스터 전용이라 직원은 어차피 못 씀).
-- --------------------------------------------------------------------------
drop policy if exists "board_posts_select_authenticated" on public.board_posts;
create policy "board_posts_select_authenticated"
  on public.board_posts for select to authenticated
  using (category = '공지사항' or not public.user_is_store_staff());

drop policy if exists "board_posts_insert_own" on public.board_posts;
create policy "board_posts_insert_own"
  on public.board_posts for insert to authenticated
  with check (auth.uid() = created_by and not public.user_is_store_staff());

drop policy if exists "board_comments_select_authenticated" on public.board_comments;
create policy "board_comments_select_authenticated"
  on public.board_comments for select to authenticated
  using (
    not public.user_is_store_staff()
    or exists (
      select 1 from public.board_posts p
      where p.id = board_comments.post_id and p.category = '공지사항'
    )
  );

drop policy if exists "board_comments_insert_own" on public.board_comments;
create policy "board_comments_insert_own"
  on public.board_comments for insert to authenticated
  with check (
    auth.uid() = created_by
    and (
      not public.user_is_store_staff()
      or exists (
        select 1 from public.board_posts p
        where p.id = board_comments.post_id and p.category = '공지사항'
      )
    )
  );

drop policy if exists "board_attachments_select_authenticated" on public.board_attachments;
create policy "board_attachments_select_authenticated"
  on public.board_attachments for select to authenticated
  using (
    not public.user_is_store_staff()
    or exists (
      select 1 from public.board_posts p
      where p.id = board_attachments.post_id and p.category = '공지사항'
    )
    or exists (
      select 1 from public.board_comments c
      join public.board_posts p on p.id = c.post_id
      where c.id = board_attachments.comment_id and p.category = '공지사항'
    )
  );

drop policy if exists "board_attachments_insert_own" on public.board_attachments;
create policy "board_attachments_insert_own"
  on public.board_attachments for insert to authenticated
  with check (
    auth.uid() = created_by
    and (
      not public.user_is_store_staff()
      or exists (
        select 1 from public.board_posts p
        where p.id = board_attachments.post_id and p.category = '공지사항'
      )
      or exists (
        select 1 from public.board_comments c
        join public.board_posts p on p.id = c.post_id
        where c.id = board_attachments.comment_id and p.category = '공지사항'
      )
    )
  );

-- --------------------------------------------------------------------------
-- 확인: 대기 중인 가입 신청이 있는지
-- --------------------------------------------------------------------------
select id, email, name, status, role, store_id from public.profiles where status = 'pending';
