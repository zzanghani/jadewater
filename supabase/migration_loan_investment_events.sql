-- ============================================================================
-- 금전대차 상환표: "투자금 추가" 기록.
--
-- 지금까지 투자금이 늘면 투자금 숫자를 손으로 고쳐야 했다. 상환 기록처럼
-- 날짜·금액을 한 줄 남기면 투자금(principal)에 자동으로 더해지게 한다.
--   loan_repayment_events.kind = 'repay'(상환, 기본값) | 'invest'(투자금 추가)
-- - 상환액(repaid)은 전처럼 kind='repay' 합계로 다시 계산한다.
-- - 투자금(principal)은 투자 기록이 들어오면 그만큼 더하고, 지우면 뺀다
--   (기존 투자금은 그대로 두고 증감만 반영 → 정보 수정에서 직접 고치는 것도 계속 가능).
-- 여러 번 실행해도 안전합니다. migration_loan_repayments.sql 이후에 실행.
-- ============================================================================

alter table public.loan_repayment_events
  add column if not exists kind text not null default 'repay';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'loan_repayment_events_kind_check'
  ) then
    alter table public.loan_repayment_events
      add constraint loan_repayment_events_kind_check check (kind in ('repay', 'invest'));
  end if;
end $$;

create or replace function public.sync_loan_repaid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.loan_id, old.loan_id);
begin
  -- 투자금: 증감만 반영
  if tg_op in ('UPDATE', 'DELETE') and old.kind = 'invest' then
    update public.loan_repayments set principal = principal - old.amount where id = old.loan_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.kind = 'invest' then
    update public.loan_repayments set principal = principal + new.amount where id = new.loan_id;
  end if;

  -- 상환액: 상환 기록 합계로 다시 계산
  update public.loan_repayments
  set repaid = coalesce(
    (select sum(amount) from public.loan_repayment_events where loan_id = target and kind = 'repay'),
    0
  )
  where id = target;
  return null;
end;
$$;
