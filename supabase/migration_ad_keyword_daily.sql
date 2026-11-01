-- ============================================================================
-- 파워링크 키워드별 일 성과 (매일 23:55 ad-keyword-sync 크론이 네이버 stats에서 받아 쌓는다).
-- 매장·일자·캠페인·광고그룹·키워드 한 줄에 노출·클릭·광고비·전환·평균순위와,
-- 그 날 기준 입찰가·품질지수·켜짐/꺼짐 상태(동기화 시점 값; 지난 날 행은 처음 쌓인 값을 유지).
-- 쓰기는 서비스 키, 읽기는 지점장·마스터(다른 광고 테이블과 같음). 여러 번 실행해도 안전합니다.
-- ============================================================================
create table if not exists public.ad_keyword_daily_stats (
  store_id uuid not null references public.stores (id) on delete cascade,
  date date not null,
  keyword_id text not null,              -- 네이버 nccKeywordId
  keyword text not null,
  campaign_id text not null,
  campaign_name text not null default '',
  campaign_tp text,                      -- WEB_SITE(파워링크) · PLACE(플레이스) …
  adgroup_id text not null,
  adgroup_name text not null default '',
  imp integer not null default 0,
  clk integer not null default 0,
  cost integer not null default 0,       -- 원 (VAT 제외, 네이버 salesAmt)
  conv integer not null default 0,
  avg_rank numeric(6,2),                 -- 평균 노출 순위 (노출 없으면 null)
  bid_amt integer,                       -- 적용 입찰가(원): 그룹 입찰가 사용 시 그룹 값
  use_group_bid boolean not null default false,
  quality_index smallint,                -- 품질지수 1~7
  user_lock boolean not null default false, -- true = 꺼짐
  status text,
  synced_at timestamptz not null default now(),
  primary key (store_id, date, keyword_id)
);
alter table public.ad_keyword_daily_stats enable row level security;
drop policy if exists "ad_keyword_daily_stats_select" on public.ad_keyword_daily_stats;
create policy "ad_keyword_daily_stats_select" on public.ad_keyword_daily_stats for select to authenticated using (public.user_is_store_manager(store_id));
create index if not exists ad_keyword_daily_stats_store_date_idx on public.ad_keyword_daily_stats (store_id, date);
create index if not exists ad_keyword_daily_stats_store_kw_idx on public.ad_keyword_daily_stats (store_id, keyword_id, date);
