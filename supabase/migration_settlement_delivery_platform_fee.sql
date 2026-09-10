-- ============================================================================
-- 월말정산에 배달플랫폼 수수료(쿠팡이츠·배민 매출의 25%) 자동계산 항목 추가.
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 여러 번 실행해도 안전합니다.
-- ============================================================================

alter table public.monthly_settlements
  add column if not exists delivery_platform_fee numeric(12, 0) not null default 0;
