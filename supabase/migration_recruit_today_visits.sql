-- ============================================================================
-- 체험단 "오늘 방문" — 홀 직원도 홈에서 오늘 체험단 방문자를 볼 수 있게 한다.
-- recruit_applicants는 지점장만 읽을 수 있으므로(RLS), 그 매장 소속이면 누구나
-- 읽을 수 있는 함수를 하나 두고 "날짜 범위 안의 방문 예정자, 필요한 칸만" 돌려준다.
-- 점수·블로그 지표·연락처는 내려주지 않는다(연락처는 지점장만, 앱 체험 진행 탭에서).
-- 여러 번 실행해도 안전합니다. migration_recruit_notify.sql 이후에 실행.
-- ============================================================================

create or replace function public.recruit_visits_between(
  p_store_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  id uuid,
  applicant_name text,
  blog_id text,
  visit_at timestamptz,
  visit_party integer,
  visit_note text,
  visited_at timestamptz,
  no_show boolean,
  visit_source text,
  campaign_title text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.applicant_name, a.blog_id, a.visit_at, a.visit_party, a.visit_note,
         a.visited_at, a.no_show, a.visit_source, a.campaign_title
  from public.recruit_applicants a
  where a.store_id = p_store_id
    and a.selected
    and a.visit_at >= p_from
    and a.visit_at < p_to
    and public.user_can_access_store(p_store_id)
  order by a.visit_at;
$$;

revoke all on function public.recruit_visits_between(uuid, timestamptz, timestamptz) from public;
grant execute on function public.recruit_visits_between(uuid, timestamptz, timestamptz) to authenticated;
