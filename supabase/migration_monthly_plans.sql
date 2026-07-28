-- ============================================================================
-- 월간계획 (본사 캘린더: 마스터 + 팀 계정 전용) + 팀 계정 매출조회/현장지출 완화
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 월간계획은 매장 소속이 없는 "본사" 계정(store_id is null — 마스터도, 팀
-- 계정도 여기 해당)만 보고 쓸 수 있다. 일정마다 댓글 스레드가 달리고, 댓글에
-- 파일/이미지를 첨부할 수 있다(게시판의 board_comments/board_attachments와
-- 같은 구조). 아울러 팀 계정 홈 화면에 매장 매출 차트와 현장지출 등록을 새로
-- 열어주기로 해서, daily_closings 조회와 field_expenses 조회/등록은 매장
-- 운영 제한(user_can_access_store_ops)에서 다시 완화한다.
-- ============================================================================

create or replace function public.user_is_hq()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and store_id is null
  );
$$;

create table if not exists public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_date date not null,
  end_date date not null,
  color text not null default '#2f7a63',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint monthly_plans_date_order check (end_date >= start_date)
);

alter table public.monthly_plans enable row level security;

drop policy if exists "monthly_plans_select_hq" on public.monthly_plans;
create policy "monthly_plans_select_hq"
  on public.monthly_plans for select
  to authenticated
  using (public.user_is_hq());

drop policy if exists "monthly_plans_insert_hq" on public.monthly_plans;
create policy "monthly_plans_insert_hq"
  on public.monthly_plans for insert
  to authenticated
  with check (public.user_is_hq() and auth.uid() = created_by);

drop policy if exists "monthly_plans_delete_hq" on public.monthly_plans;
create policy "monthly_plans_delete_hq"
  on public.monthly_plans for delete
  to authenticated
  using (public.user_is_hq());

create index if not exists monthly_plans_range_idx on public.monthly_plans (start_date, end_date);

-- --------------------------------------------------------------------------
-- 일정별 댓글 스레드 + 파일/이미지 첨부 (게시판과 동일한 구조)
-- --------------------------------------------------------------------------
create table if not exists public.monthly_plan_comments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.monthly_plans (id) on delete cascade,
  body text not null default '',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.monthly_plan_comments enable row level security;

drop policy if exists "monthly_plan_comments_select_hq" on public.monthly_plan_comments;
create policy "monthly_plan_comments_select_hq"
  on public.monthly_plan_comments for select
  to authenticated
  using (public.user_is_hq());

drop policy if exists "monthly_plan_comments_insert_hq" on public.monthly_plan_comments;
create policy "monthly_plan_comments_insert_hq"
  on public.monthly_plan_comments for insert
  to authenticated
  with check (public.user_is_hq() and auth.uid() = created_by);

drop policy if exists "monthly_plan_comments_delete_own" on public.monthly_plan_comments;
create policy "monthly_plan_comments_delete_own"
  on public.monthly_plan_comments for delete
  to authenticated
  using (auth.uid() = created_by);

create index if not exists monthly_plan_comments_plan_id_idx on public.monthly_plan_comments (plan_id, created_at);

create table if not exists public.monthly_plan_attachments (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.monthly_plan_comments (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.monthly_plan_attachments enable row level security;

drop policy if exists "monthly_plan_attachments_select_hq" on public.monthly_plan_attachments;
create policy "monthly_plan_attachments_select_hq"
  on public.monthly_plan_attachments for select
  to authenticated
  using (public.user_is_hq());

drop policy if exists "monthly_plan_attachments_insert_hq" on public.monthly_plan_attachments;
create policy "monthly_plan_attachments_insert_hq"
  on public.monthly_plan_attachments for insert
  to authenticated
  with check (public.user_is_hq() and auth.uid() = created_by);

drop policy if exists "monthly_plan_attachments_delete_own" on public.monthly_plan_attachments;
create policy "monthly_plan_attachments_delete_own"
  on public.monthly_plan_attachments for delete
  to authenticated
  using (auth.uid() = created_by);

create index if not exists monthly_plan_attachments_comment_id_idx on public.monthly_plan_attachments (comment_id);

insert into storage.buckets (id, name, public)
values ('monthly-plans', 'monthly-plans', false)
on conflict (id) do nothing;

drop policy if exists "monthly_plans_files_insert_hq" on storage.objects;
create policy "monthly_plans_files_insert_hq"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'monthly-plans' and public.user_is_hq());

drop policy if exists "monthly_plans_files_select_hq" on storage.objects;
create policy "monthly_plans_files_select_hq"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'monthly-plans' and public.user_is_hq());

drop policy if exists "monthly_plans_files_delete_hq" on storage.objects;
create policy "monthly_plans_files_delete_hq"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'monthly-plans' and public.user_is_hq());

-- --------------------------------------------------------------------------
-- 팀 계정 홈 화면: 최근 7일 매출 차트를 보려면 daily_closings 조회가 필요하다
-- (입력/수정은 여전히 매장 운영 계정만 — insert/update 정책은 그대로 둔다)
-- --------------------------------------------------------------------------
drop policy if exists "daily_closings_select_authenticated" on public.daily_closings;
create policy "daily_closings_select_authenticated"
  on public.daily_closings for select
  to authenticated
  using (public.user_can_access_store(store_id));

-- --------------------------------------------------------------------------
-- 팀 계정 현장지출: 조회 + 등록을 열어준다 (삭제는 여전히 매장 운영 계정만)
-- --------------------------------------------------------------------------
drop policy if exists "field_expenses_select_authenticated" on public.field_expenses;
create policy "field_expenses_select_authenticated"
  on public.field_expenses for select
  to authenticated
  using (public.user_can_access_store(store_id));

drop policy if exists "field_expenses_insert_authenticated" on public.field_expenses;
create policy "field_expenses_insert_authenticated"
  on public.field_expenses for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

-- 현장지출 영수증 사진(receipts 스토리지 버킷)도 동일하게 완화
drop policy if exists "receipts_insert_authenticated" on storage.objects;
create policy "receipts_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and public.user_can_access_store((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "receipts_select_authenticated" on storage.objects;
create policy "receipts_select_authenticated"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and public.user_can_access_store((storage.foldername(name))[1]::uuid)
  );
