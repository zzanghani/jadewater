-- ============================================================================
-- 본사 팀 계정(마케팅/디자인/운영/R&D)의 홈 화면 "최근 7일 매출"/오늘 매출/
-- 월 비교 위젯이 항상 0으로 비어 보이던 문제 수정.
--
-- 원인: daily_closings의 RLS(user_can_access_store_ops)가 department가
-- 있는 팀 계정은 항상 차단하도록 설계돼 있는데(매장 세부 재무정보 보호
-- 목적), 홈 화면은 팀 계정에게도 이 위젯을 보여주게 만들어져 있어서
-- 화면은 뜨지만 데이터가 항상 비어 있었음.
--
-- 해결: daily_closings 테이블 자체의 접근 권한은 그대로 두고(카드/현금
-- 등 세부 매출은 여전히 매장 계정만), "날짜/매장/총매출" 3개 컬럼만
-- 돌려주는 별도 함수를 만들어 본사 계정(팀 계정 + 마스터)만 실행할 수
-- 있게 한다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다.
-- ============================================================================

create or replace function public.get_daily_closings_totals(p_start date, p_end date)
returns table (date date, store_id uuid, grand_total numeric)
language sql
stable
security definer
set search_path = public
as $$
  select dc.date, dc.store_id, dc.grand_total
  from public.daily_closings dc
  where dc.date >= p_start
    and dc.date <= p_end
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.department is not null or p.store_id is null) -- 본사(팀 계정 + 마스터)만
    );
$$;

grant execute on function public.get_daily_closings_totals(date, date) to authenticated;
