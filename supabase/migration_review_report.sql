-- ============================================================================
-- 리뷰 리포트 기능용 테이블
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 이 데이터는 앱 사용자가 직접 입력하지 않고, 외부 리뷰 수집 자동화
-- (예: n8n, Zapier, 크롤러 스크립트 등)가 서비스 롤 키로 채워 넣는 것을
-- 전제로 설계했습니다. 그래서 RLS는 조회(select) 정책만 있고,
-- insert/update 정책은 없습니다 (서비스 롤은 RLS를 무시하므로 문제 없음).
-- ============================================================================

-- --------------------------------------------------------------------------
-- review_platform_stats: 매장 x 날짜 x 플랫폼별 통계 (평점 / 누적 리뷰수 / 전일 대비 증가건수)
-- --------------------------------------------------------------------------
create table if not exists public.review_platform_stats (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  date date not null,
  platform text not null check (platform in ('네이버', '카카오맵', '구글')),
  rating numeric(2, 1) not null default 0,
  review_count integer not null default 0,
  change_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, date, platform)
);

alter table public.review_platform_stats enable row level security;

create policy "review_platform_stats_select_authenticated"
  on public.review_platform_stats for select
  to authenticated
  using (public.user_can_access_store(store_id));

-- --------------------------------------------------------------------------
-- reviews: 그 날짜에 새로 감지된 개별 리뷰 (평점 3점 이하는 화면에서 "나쁜 리뷰"로 표시)
-- --------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  date date not null,
  platform text not null check (platform in ('네이버', '카카오맵', '구글')),
  rating integer not null check (rating between 1 and 5),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

create policy "reviews_select_authenticated"
  on public.reviews for select
  to authenticated
  using (public.user_can_access_store(store_id));

-- --------------------------------------------------------------------------
-- review_ai_summaries: 매장 x 날짜별 AI 요약 (하루 1건)
-- --------------------------------------------------------------------------
create table if not exists public.review_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  date date not null,
  summary text not null default '',
  created_at timestamptz not null default now(),
  unique (store_id, date)
);

alter table public.review_ai_summaries enable row level security;

create policy "review_ai_summaries_select_authenticated"
  on public.review_ai_summaries for select
  to authenticated
  using (public.user_can_access_store(store_id));

-- --------------------------------------------------------------------------
-- 인덱스
-- --------------------------------------------------------------------------
create index if not exists review_platform_stats_date_idx on public.review_platform_stats (date desc);
create index if not exists review_platform_stats_store_id_idx on public.review_platform_stats (store_id);
create index if not exists reviews_date_idx on public.reviews (date desc);
create index if not exists reviews_store_id_idx on public.reviews (store_id);
create index if not exists review_ai_summaries_date_idx on public.review_ai_summaries (date desc);
create index if not exists review_ai_summaries_store_id_idx on public.review_ai_summaries (store_id);

-- ============================================================================
-- (선택) 오늘/어제 샘플 데이터 — 화면이 실제로 어떻게 보이는지 확인용입니다.
-- 필요 없으면 아래 블록은 실행하지 않아도 됩니다. 나중에 자동화가 실제
-- 데이터를 채우기 시작하면 이 샘플 행은 지워도 됩니다.
-- ============================================================================

insert into public.review_platform_stats (store_id, date, platform, rating, review_count, change_count)
select (select id from public.stores where name = v.store_name), v.date, v.platform, v.rating, v.review_count, v.change_count
from (values
  ('제이드앤워터 옥수본점', current_date, '네이버', 4.8, 892, 2),
  ('제이드앤워터 옥수본점', current_date, '카카오맵', 4.5, 134, 0),
  ('제이드앤워터 옥수본점', current_date, '구글', 4.7, 67, 1),
  ('제이드앤워터 서울역점', current_date, '네이버', 4.6, 445, 0),
  ('제이드앤워터 서울역점', current_date, '카카오맵', 4.3, 89, 1),
  ('제이드앤워터 서울역점', current_date, '구글', 4.5, 52, 0),
  ('제이드앤워터 성수LCDC', current_date, '네이버', 4.9, 1203, 3),
  ('제이드앤워터 성수LCDC', current_date, '카카오맵', 4.7, 267, 1),
  ('제이드앤워터 성수LCDC', current_date, '구글', 4.8, 189, 0),
  ('제이드앤워터 스타필드하남', current_date, '네이버', 4.5, 334, 0),
  ('제이드앤워터 스타필드하남', current_date, '카카오맵', 4.2, 78, 0),
  ('제이드앤워터 스타필드하남', current_date, '구글', 4.4, 45, 0)
) as v(store_name, date, platform, rating, review_count, change_count)
on conflict (store_id, date, platform) do nothing;

insert into public.reviews (store_id, date, platform, rating, body)
select (select id from public.stores where name = v.store_name), v.date, v.platform, v.rating, v.body
from (values
  ('제이드앤워터 옥수본점', current_date, '네이버', 5, '분위기도 좋고 음식도 맛있어요! 직원분들이 너무 친절했어요 😊'),
  ('제이드앤워터 옥수본점', current_date, '구글', 4, '브런치 맛집이에요. 웨이팅이 좀 있지만 충분히 가치 있어요.'),
  ('제이드앤워터 서울역점', current_date, '카카오맵', 3, '음식은 괜찮은데 가격이 좀 높은 편이에요.'),
  ('제이드앤워터 성수LCDC', current_date, '네이버', 5, '성수에서 제일 좋아하는 브런치 카페예요! 인테리어가 너무 예뻐요 📸'),
  ('제이드앤워터 성수LCDC', current_date, '네이버', 5, '데이트 코스로 완벽해요. 음식도 맛있고 사진도 잘 나와요!'),
  ('제이드앤워터 성수LCDC', current_date, '카카오맵', 5, '성수LCDC 갈 때마다 들르는 곳이에요. 항상 만족해요.')
) as v(store_name, date, platform, rating, body);

insert into public.review_ai_summaries (store_id, date, summary)
select (select id from public.stores where name = v.store_name), v.date, v.summary
from (values
  ('제이드앤워터 옥수본점', current_date, '1) 음식 퀄리티와 분위기 칭찬이 압도적이에요.

2) 칭찬한 점
– 음식 맛과 플레이팅 인상적이라는 의견 다수
– 직원 친절도 자주 언급됨
– 브런치 메뉴 다양성 호평

3) 불만/개선할 점
– 피크타임 웨이팅이 길다는 지적

4) 오늘 실천 제안
– 대기 고객을 위한 무료 음료 서비스 도입을 검토해보세요.'),
  ('제이드앤워터 서울역점', current_date, '1) 서울역 직장인 점심 수요가 높은 매장이에요.

2) 칭찬한 점
– 위치 접근성 매우 긍정적
– 런치 세트 언급 다수

3) 불만/개선할 점
– 가격 대비 양 부족 지적 있음

4) 오늘 실천 제안
– 저녁 타임 분위기 개선으로 테이블 회전율을 높여보세요.'),
  ('제이드앤워터 성수LCDC', current_date, '1) 성수 감성 인테리어와 포토스팟으로 SNS 유입이 활발해요.

2) 칭찬한 점
– 인테리어·포토스팟 압도적 긍정 평가
– 음식 플레이팅과 맛 호평
– 주말 데이트 코스 추천 다수

3) 불만/개선할 점
– 특이사항 없음

4) 오늘 실천 제안
– 인스타그램 태그 이벤트로 자연스러운 바이럴 효과를 노려보세요.')
) as v(store_name, date, summary)
on conflict (store_id, date) do nothing;
