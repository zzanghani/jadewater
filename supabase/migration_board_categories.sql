-- ============================================================================
-- 게시판을 4개 카테고리(마케팅/운영HR/디자인/R&D)로 분리
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

alter table public.board_posts
  add column if not exists category text not null default '운영HR'
    check (category in ('마케팅', '운영HR', '디자인', 'R&D'));

create index if not exists board_posts_category_idx on public.board_posts (category);
