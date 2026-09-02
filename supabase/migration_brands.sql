-- ============================================================================
-- 브랜드(brands) 층 추가 마이그레이션
-- Supabase SQL Editor에서 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 구조: 베스트메이트컴퍼니(본사) → 브랜드(제이드앤워터 / 정다미) → 매장
--
-- 지금까지는 매장 "이름 글자"로 매장별 예외를 판별했다(하남이면 런치/디너를
-- 안 나눔, 이름에 "서울역"이 들어가면 서울역 색·서울역 블로그 글). 정다미
-- 서울역점이 들어오면 제이드앤워터 서울역점과 이름이 겹쳐서 오인식되므로,
-- 이름 매칭을 전부 컬럼 값으로 옮긴다.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. brands 테이블
-- --------------------------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  -- 헤더 로고 이미지 경로. 비어 있으면 앱이 브랜드명을 글자로 대신 보여준다.
  logo_path text,
  -- globals.css의 톤 클래스 이름 (.theme-jadewater / .theme-jeongdami)
  theme_class text not null default 'theme-jadewater',
  -- 네이버 블로그를 넓게 검색할 때 쓰는 검색어
  review_keyword text,
  -- 검색 결과 중 이 브랜드 글인지 걸러낼 때 쓰는 짧은 토큰
  -- ("제이드앤워터"는 글에서 "제이드 앤 워터"처럼 띄어 쓰는 경우가 많아 "제이드"만 본다)
  blog_match_token text,
  created_at timestamptz not null default now()
);

alter table public.brands enable row level security;

-- 브랜드는 로고·톤 같은 표시용 정보뿐이라 로그인한 사용자면 모두 읽을 수 있다.
-- 실제 매장 데이터 차단은 기존 stores/daily_closings RLS가 그대로 담당한다.
drop policy if exists "brands_select_authenticated" on public.brands;
create policy "brands_select_authenticated"
  on public.brands for select
  to authenticated
  using (true);

insert into public.brands (name, sort_order, logo_path, theme_class, review_keyword, blog_match_token)
values
  ('제이드앤워터', 1, '/logo.png', 'theme-jadewater', '제이드앤워터', '제이드'),
  -- 정다미 로고 PNG를 받으면 public/에 넣고 logo_path를 '/jeongdami-logo.png'로 바꾸면 된다.
  -- 그전까지는 헤더에 "정다미"가 글자로 나온다.
  ('정다미',      2, null,        'theme-jeongdami', '정다미',      '정다미')
on conflict (name) do update set
  sort_order = excluded.sort_order,
  theme_class = excluded.theme_class,
  review_keyword = excluded.review_keyword,
  blog_match_token = excluded.blog_match_token;

-- --------------------------------------------------------------------------
-- 2. stores에 브랜드 + 매장별 설정 컬럼 추가
-- --------------------------------------------------------------------------
alter table public.stores add column if not exists brand_id uuid references public.brands (id);

-- 매장 라벨 색 / 사람 이름 옆에 붙는 짧은 태그. 지금까지 이름 매칭으로 뽑던 값.
alter table public.stores add column if not exists color text not null default '#6b7280';
alter table public.stores add column if not exists short_label text;

-- 런치/디너 객수를 나눠 받을지. 하남은 브레이크타임이 없고 몰 안이라 나누지 않는다.
alter table public.stores add column if not exists uses_service_split boolean not null default true;

-- 네이버 블로그 글이 이 매장 얘기인지 판별할 지역 키워드들.
alter table public.stores add column if not exists blog_keywords text[] not null default '{}';

-- 기존 4개점을 제이드앤워터로 붙이고, 지금까지 코드에 하드코딩돼 있던 값을 옮긴다.
update public.stores s
set brand_id = b.id
from public.brands b
where b.name = '제이드앤워터' and s.brand_id is null;

update public.stores set color = '#FF6900', short_label = '옥수',   blog_keywords = array['옥수']            where name = '제이드앤워터 옥수본점';
update public.stores set color = '#002D72', short_label = '서울역', blog_keywords = array['서울역']          where name = '제이드앤워터 서울역점';
update public.stores set color = '#3AA021', short_label = '성수',   blog_keywords = array['성수']            where name = '제이드앤워터 성수LCDC';
update public.stores set color = '#BC90BF', short_label = '하남',   blog_keywords = array['하남','스타필드'] where name = '제이드앤워터 스타필드하남';

update public.stores set uses_service_split = false where name = '제이드앤워터 스타필드하남';

-- --------------------------------------------------------------------------
-- 3. 정다미 서울역점 추가
-- --------------------------------------------------------------------------
insert into public.stores (name, sort_order, brand_id, color, short_label, uses_service_split, blog_keywords)
select '정다미 서울역점', 5, b.id, '#9C3D2E', '정다미', true, array['서울역','봉래']
from public.brands b
where b.name = '정다미'
on conflict (name) do update set
  sort_order   = excluded.sort_order,
  brand_id     = excluded.brand_id,
  color        = excluded.color,
  short_label  = excluded.short_label,
  blog_keywords = excluded.blog_keywords;

-- 이제 모든 매장에 브랜드가 붙었으니 필수로 바꾼다.
alter table public.stores alter column brand_id set not null;

create index if not exists stores_brand_idx on public.stores (brand_id, sort_order);
