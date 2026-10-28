-- 검색 노출 추적: 블로그 상위30 중 우리 글의 목록(순위·제목·링크·블로거·작성일)을 날짜·키워드별로 같이 저장. 여러 번 실행해도 안전.
alter table public.search_rank_daily add column if not exists blog_posts jsonb not null default '[]'::jsonb;
