-- ============================================================================
-- 체험단 지원자 검증 (리뷰노트 2주 모집)
-- 리뷰노트 지원자 목록을 가져와 블로그마다 맛집 비중·검색 노출·협찬 비중을
-- 확인한 결과를 매장·캠페인별로 저장한다. 다시 실행해도 안전하다.
-- ============================================================================

create table if not exists public.recruit_applicants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  campaign_id text not null,          -- 리뷰노트 캠페인 번호 (붙여넣기는 'manual-YYYYMMDD')
  campaign_title text,
  blog_id text not null,
  applicant_name text,                -- 리뷰노트에 보이는 이름 (선정할 때 찾기용)
  rn jsonb,                           -- 리뷰노트가 주는 값: 노출점수·방문자·페널티·취소·등급
  metrics jsonb,                      -- 우리가 네이버에서 읽은 값
  score int,
  grade text,                         -- A / B / C
  flags text[] not null default '{}',
  checked_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (store_id, campaign_id, blog_id)
);

alter table public.recruit_applicants enable row level security;

drop policy if exists "recruit_applicants_select" on public.recruit_applicants;
create policy "recruit_applicants_select" on public.recruit_applicants
  for select to authenticated using (public.user_is_store_manager(store_id));

drop policy if exists "recruit_applicants_insert" on public.recruit_applicants;
create policy "recruit_applicants_insert" on public.recruit_applicants
  for insert to authenticated with check (public.user_is_store_manager(store_id));

drop policy if exists "recruit_applicants_update" on public.recruit_applicants;
create policy "recruit_applicants_update" on public.recruit_applicants
  for update to authenticated
  using (public.user_is_store_manager(store_id))
  with check (public.user_is_store_manager(store_id));

drop policy if exists "recruit_applicants_delete" on public.recruit_applicants;
create policy "recruit_applicants_delete" on public.recruit_applicants
  for delete to authenticated using (public.user_is_store_manager(store_id));

create index if not exists recruit_applicants_store_campaign_idx
  on public.recruit_applicants (store_id, campaign_id);
create index if not exists recruit_applicants_blog_idx
  on public.recruit_applicants (blog_id);
