-- ============================================================================
-- 게시판 상위 구분 추가: 공지사항 / 업무게시판(마케팅·운영HR·디자인·R&D)
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- category 컬럼에 '공지사항' 값을 추가로 허용한다. 화면에서는 카테고리가
-- '공지사항'이면 상위 탭 "공지사항"으로, 나머지 4개면 "업무게시판"
-- 하위 탭으로 묶어서 보여준다.
-- ============================================================================

alter table public.board_posts drop constraint if exists board_posts_category_check;
alter table public.board_posts add constraint board_posts_category_check
  check (category in ('공지사항', '마케팅', '운영HR', '디자인', 'R&D'));
