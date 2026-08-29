-- ============================================================================
-- 월말정산 "세금 및 유보금 (자동계산)" 항목에 본사운영비(총매출의 4%) 추가.
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

alter table public.monthly_settlements
  add column if not exists hq_operating_reserve numeric(12, 0) not null default 0;
