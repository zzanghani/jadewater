-- ============================================================================
-- 성과 확인 게시판: 매일 아침 크론이 매장마다 "어제 광고 성과" 글을 자동으로 올린다.
-- - ad_daily_posts      : 매장·날짜별 글(jsonb). 쓰기는 서비스 키(크론)만.
-- - ad_daily_post_reads : 누가 언제 확인했는지(점장 "확인했어요" 버튼).
-- 읽기는 지점장(자기 매장)·본사 마스터(전 매장). 여러 번 실행해도 안전합니다.
-- ============================================================================

create table if not exists public.ad_daily_posts (
  store_id uuid not null references public.stores (id) on delete cascade,
  date date not null,
  post jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (store_id, date)
);
alter table public.ad_daily_posts enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ad_daily_posts' and policyname = 'ad_daily_posts_select') then
    create policy "ad_daily_posts_select" on public.ad_daily_posts for select to authenticated using (public.user_is_store_manager(store_id));
  end if;
end $$;

create table if not exists public.ad_daily_post_reads (
  store_id uuid not null,
  date date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (store_id, date, user_id),
  foreign key (store_id, date) references public.ad_daily_posts (store_id, date) on delete cascade
);
alter table public.ad_daily_post_reads enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ad_daily_post_reads' and policyname = 'ad_daily_post_reads_select') then
    create policy "ad_daily_post_reads_select" on public.ad_daily_post_reads for select to authenticated using (public.user_is_store_manager(store_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ad_daily_post_reads' and policyname = 'ad_daily_post_reads_insert') then
    create policy "ad_daily_post_reads_insert" on public.ad_daily_post_reads for insert to authenticated with check (user_id = auth.uid() and public.user_is_store_manager(store_id));
  end if;
end $$;
