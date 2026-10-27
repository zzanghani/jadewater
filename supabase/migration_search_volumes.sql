-- 검색 노출 추적: 추적 키워드의 월 검색량(네이버 키워드 도구, PC+모바일)을 설정에 같이 저장. 여러 번 실행해도 안전.
alter table public.store_search_settings add column if not exists volumes jsonb not null default '{}'::jsonb;
