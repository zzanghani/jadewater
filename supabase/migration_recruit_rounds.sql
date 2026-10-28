-- ============================================================================
-- 체험단 자동화: 모집 회차(모집글) + 선정 승인
-- 2주마다 앱에서 모집글을 쓰고(확정) → 맥미니가 리뷰노트에 등록 →
-- 모집이 끝나면 지원자 점수 → 점장이 앱에서 선정 승인 → 맥미니가 리뷰노트에 선정.
-- 다시 실행해도 안전하다. (migration_recruit_applicants.sql 다음에 실행)
-- ============================================================================

create table if not exists public.recruit_rounds (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  -- draft 작성 중 · confirmed 확정(등록 대기) · registered 리뷰노트 등록됨
  -- selecting 지원자 확인 중 · approved 선정 승인(리뷰노트 반영 대기) · done 선정 완료
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'registered', 'selecting', 'approved', 'done')),
  campaign_id text,                    -- 리뷰노트 캠페인 번호 (등록 후)
  title text,                          -- 리뷰노트 체험단 이름 (예: 제이드앤워터 옥수점)
  offer text,                          -- 제공 내역 (예: 매장식사권 5만원권)
  keywords text[] not null default '{}', -- 리뷰노트 키워드 1~3
  information text,                    -- 제목·본문 작성 가이드
  possible_days text,                  -- 방문 가능 요일
  possible_time text,                  -- 방문 가능 시간
  schedule_information text,           -- 라스트오더·브레이크타임 등
  inf_num int not null default 20,     -- 모집(선정) 인원
  ai_drafted boolean not null default false,
  created_by uuid references auth.users (id),
  confirmed_at timestamptz,
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists recruit_rounds_store_campaign_uidx
  on public.recruit_rounds (store_id, campaign_id) where campaign_id is not null;
create index if not exists recruit_rounds_store_idx on public.recruit_rounds (store_id, created_at desc);

alter table public.recruit_rounds enable row level security;

drop policy if exists "recruit_rounds_select" on public.recruit_rounds;
create policy "recruit_rounds_select" on public.recruit_rounds
  for select to authenticated using (public.user_is_store_manager(store_id));

drop policy if exists "recruit_rounds_insert" on public.recruit_rounds;
create policy "recruit_rounds_insert" on public.recruit_rounds
  for insert to authenticated with check (public.user_is_store_manager(store_id));

drop policy if exists "recruit_rounds_update" on public.recruit_rounds;
create policy "recruit_rounds_update" on public.recruit_rounds
  for update to authenticated
  using (public.user_is_store_manager(store_id))
  with check (public.user_is_store_manager(store_id));

drop policy if exists "recruit_rounds_delete" on public.recruit_rounds;
create policy "recruit_rounds_delete" on public.recruit_rounds
  for delete to authenticated using (public.user_is_store_manager(store_id));

-- 지원자별 선정 체크 (점장이 승인한 사람만 true)
alter table public.recruit_applicants add column if not exists selected boolean not null default false;
