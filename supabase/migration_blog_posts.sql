-- ============================================================================
-- 네이버 블로그 후기 수집용 테이블
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  date date not null,            -- 수집(리포트 표시)된 날짜
  posted_at date,                -- 실제 블로그 글이 올라온 날짜
  title text not null,
  body text,
  blogger_name text,
  url text not null,
  created_at timestamptz not null default now(),
  unique (store_id, url)
);

alter table public.blog_posts enable row level security;

create policy "blog_posts_select_authenticated"
  on public.blog_posts for select
  to authenticated
  using (public.user_can_access_store(store_id));

create index if not exists blog_posts_date_idx on public.blog_posts (date desc);
create index if not exists blog_posts_store_id_idx on public.blog_posts (store_id);
