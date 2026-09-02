-- ============================================================================
-- 월말정산 · 스케줄 수정 잠금 암호를 브랜드별로 분리
--
-- 지금까지는 암호가 앱 코드(lib/appPassword.ts)에 글자 그대로 적혀 있었다.
-- 그러면 (1) 깃허브 코드를 볼 수 있는 사람은 암호를 다 볼 수 있고,
-- (2) 브랜드가 늘어도 전 매장이 한 암호를 쓴다. 그래서 암호를 DB로 옮기고
-- 브랜드별로 나눈다.
--
-- 암호는 brand_secrets 테이블에 들어가고, 이 테이블은 RLS 정책을 하나도 두지
-- 않아서 앱에서 직접 읽을 수 없다. 앱은 "이 암호가 맞냐"만 물어보고
-- 맞다/틀리다만 돌려받는다(verify_brand_admin_password 함수).
--
-- ⚠ 아래 두 줄의 암호를 실제로 쓸 값으로 바꾼 다음 실행하세요.
--   제이드앤워터 암호도 새로 정하시길 권합니다 — 지금 쓰는 암호는 이미
--   깃허브 코드에 적혀 있던 값이라 안전하지 않습니다.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. 암호 보관 테이블 — 앱에서 직접 못 읽는다(RLS 켜고 정책 없음)
-- --------------------------------------------------------------------------
create table if not exists public.brand_secrets (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  admin_password text not null,
  updated_at timestamptz not null default now()
);

alter table public.brand_secrets enable row level security;

-- 정책을 하나도 만들지 않는다 = 로그인한 사용자도 이 테이블을 읽거나 쓸 수 없다.
-- 아래 verify 함수만 security definer로 우회해서 대조한다.
revoke all on public.brand_secrets from anon, authenticated;

-- --------------------------------------------------------------------------
-- 2. 암호 대조 함수 — 맞다/틀리다만 돌려준다
-- --------------------------------------------------------------------------
create or replace function public.verify_brand_admin_password(
  p_brand_id uuid,
  p_attempt text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.brand_secrets
    where brand_id = p_brand_id
      and admin_password = p_attempt
  );
$$;

revoke all on function public.verify_brand_admin_password(uuid, text) from public;
grant execute on function public.verify_brand_admin_password(uuid, text) to authenticated;

-- --------------------------------------------------------------------------
-- 3. 브랜드별 암호 넣기
--    ⚠ 아래 '여기에...' 두 곳을 실제 암호로 바꾸고 실행하세요.
-- --------------------------------------------------------------------------
insert into public.brand_secrets (brand_id, admin_password)
select b.id, '여기에_제이드앤워터_새암호'
from public.brands b where b.name = '제이드앤워터'
on conflict (brand_id) do update set
  admin_password = excluded.admin_password,
  updated_at = now();

insert into public.brand_secrets (brand_id, admin_password)
select b.id, '여기에_정다미_암호'
from public.brands b where b.name = '정다미'
on conflict (brand_id) do update set
  admin_password = excluded.admin_password,
  updated_at = now();

-- --------------------------------------------------------------------------
-- 4. 확인 — 브랜드마다 한 줄씩, 총 2줄이 나와야 합니다.
--    (암호 자체는 보여주지 않고 설정 여부만 확인합니다)
-- --------------------------------------------------------------------------
select
  b.name as brand_name,
  case when s.admin_password is null then '❌ 미설정' else '✅ 설정됨' end as password_status,
  s.updated_at
from public.brands b
left join public.brand_secrets s on s.brand_id = b.id
order by b.sort_order;

-- ============================================================================
-- 나중에 암호만 바꾸고 싶을 때는 이 한 줄만 실행하면 됩니다:
--
--   update public.brand_secrets set admin_password = '새암호', updated_at = now()
--   where brand_id = (select id from public.brands where name = '정다미');
-- ============================================================================
