-- ============================================================================
-- 재고관리 예시 품목 시드 (매장마다 아직 등록된 품목이 없으니 예시로 채워둠)
-- 이미 같은 이름의 품목이 등록돼 있으면 건너뛰므로 여러 번 실행해도 안전합니다.
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

insert into public.inventory_items (store_id, section, name, unit, created_by)
select
  s.id,
  v.section,
  v.name,
  v.unit,
  p.id
from public.stores s
cross join (
  values
    ('홀', '콜라', '개'),
    ('홀', '사이다', '개'),
    ('홀', '오렌지주스', '개'),
    ('홀', '냅킨', '개'),
    ('홀', '물티슈', '개'),
    ('주방', '파스타면', 'kg'),
    ('주방', '오렌지치킨', '개'),
    ('주방', '새우패티', '개'),
    ('주방', '몬테크리스토', '개')
) as v(section, name, unit)
join lateral (
  select p.id from public.profiles p where p.store_id = s.id limit 1
) p on true
where not exists (
  select 1
  from public.inventory_items existing
  where existing.store_id = s.id
    and existing.section = v.section
    and existing.name = v.name
);
