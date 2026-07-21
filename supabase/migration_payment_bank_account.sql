-- ============================================================================
-- 입금요청 메모(memo) -> 은행명/계좌번호(bank_name / account_number)로 교체
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

alter table public.payment_requests
  add column if not exists bank_name text,
  add column if not exists account_number text;

alter table public.payment_requests
  drop column if exists memo;
