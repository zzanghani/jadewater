-- 브랜드별 기능 모듈 구독(brand_modules)
--
-- 앱을 외부 브랜드에 팔 때의 요금 구조: 기본 기능(마감·입고·지출·재고·스케줄·
-- 게시판·메시지·매출 분석·포스 연동 등)은 누구나 무료로 쓰고, 그 위에 모듈
-- (정산·급여 / 인사·평가(GPS 출퇴근 포함) / 리뷰·광고 / 체험단)을 월 결제로 추가한다.
-- 모듈 목록과 화면 매핑은 앱 코드 lib/modules.ts 가 기준이고, 이 테이블은
-- "어느 브랜드가 어떤 모듈을 켰는지"만 담는다. 결제가 붙기 전까지는 본사
-- 마스터가 /modules 화면에서 손으로 켜고 끈다.

create table if not exists public.brand_modules (
  brand_id uuid not null references public.brands (id) on delete cascade,
  module_key text not null,
  status text not null default 'active'
    check (status in ('active', 'trial', 'inactive')),
  -- trial 이면 이 시각까지 쓸 수 있다. 지나면 앱이 inactive 로 본다.
  trial_ends_at timestamptz,
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  -- 결제 연동 전 수동 운영 메모 ("내부 브랜드", "베타 무료" 등)
  note text,
  primary key (brand_id, module_key)
);

alter table public.brand_modules enable row level security;

-- 어떤 모듈이 켜져 있는지는 메뉴 표시용이라 로그인한 사용자면 읽는다.
drop policy if exists "brand_modules_select_authenticated" on public.brand_modules;
create policy "brand_modules_select_authenticated"
  on public.brand_modules for select
  to authenticated
  using (true);

-- 켜고 끄는 건 본사 마스터만.
drop policy if exists "brand_modules_write_master" on public.brand_modules;
create policy "brand_modules_write_master"
  on public.brand_modules for all
  to authenticated
  using (public.user_is_master())
  with check (public.user_is_master());

-- 지금 있는 브랜드(제이드앤워터·정다미)는 운영사 내부 브랜드라 모든 모듈을 켠다.
-- 이후 새로 만들어지는 브랜드는 행이 없으므로 기본 기능만 쓴다.
insert into public.brand_modules (brand_id, module_key, status, note)
select b.id, m.key, 'active', '운영사 내부 브랜드'
from public.brands b
cross join (values ('finance'), ('hr'), ('marketing'), ('recruit')) as m(key)
on conflict (brand_id, module_key) do nothing;
