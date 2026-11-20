-- ============================================================================
-- 토스 상점 번호가 바뀌어도(개인→법인 전환 등) 지난 매출이 끊기지 않게.
-- store_toss_merchants에 옛 번호(prev_merchant_id)와 옛 번호가 유효한 마지막 날(prev_until)을 둔다.
-- 동기화는 prev_until까지는 옛 번호로, 그 뒤는 새 번호로 읽는다. 여러 번 실행해도 안전합니다.
-- ============================================================================
alter table public.store_toss_merchants add column if not exists prev_merchant_id text;
alter table public.store_toss_merchants add column if not exists prev_until date;

-- 2026-11-20 옥수본점 법인 전환: 193461 → 745969. 11-19까지는 옛 번호로 읽는다.
update public.store_toss_merchants
   set prev_merchant_id = '193461', prev_until = '2026-11-19'
 where merchant_id = '745969' and prev_merchant_id is null;
