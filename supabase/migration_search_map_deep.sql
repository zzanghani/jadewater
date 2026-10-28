-- 검색 노출 추적: 맥미니가 네이버 지도(map.naver.com)를 실제 브라우저로 열어 읽은 "깊은" 지도 순위.
-- 네이버 공식 조회는 상위 5까지만 주므로, 그 밖 순위(광고 제외 N위, 광고 포함 N번째, 확인한 가게 수)를 따로 둔다.
-- 여러 번 실행해도 안전.
alter table public.search_rank_daily add column if not exists map_deep_rank smallint;      -- 광고 제외 순위 (못 찾으면 null)
alter table public.search_rank_daily add column if not exists map_pos smallint;            -- 광고 포함 목록 위치
alter table public.search_rank_daily add column if not exists map_checked smallint;        -- 광고 제외 확인한 가게 수 (null = 맥미니 확인 전)
alter table public.search_rank_daily add column if not exists map_name text;               -- 우리 가게로 판정한 목록 이름 (오판 확인용)
alter table public.search_rank_daily add column if not exists map_deep_at timestamptz;
alter table public.store_search_settings add column if not exists map_note text;           -- 맥미니 마지막 실행 메모 (오류 등)
alter table public.store_search_settings add column if not exists map_at timestamptz;
