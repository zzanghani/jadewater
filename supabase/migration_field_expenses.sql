-- ============================================================================
-- 현장지출 (영수증 촬영 기반 지출 등록) 테이블 + 영수증 사진 저장소
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================================

create table if not exists public.field_expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  date date not null,
  category text not null check (
    category in ('식자재', '소모품', '유류비', '복리후생', '운영', '마케팅', '기타')
  ),
  description text not null,
  amount numeric(12, 0) not null,
  payment_method text not null check (payment_method in ('법인카드', '현금', '자동이체')),
  receipt_photo_path text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.field_expenses enable row level security;

create policy "field_expenses_select_authenticated"
  on public.field_expenses for select
  to authenticated
  using (public.user_can_access_store(store_id));

create policy "field_expenses_insert_authenticated"
  on public.field_expenses for insert
  to authenticated
  with check (public.user_can_access_store(store_id) and auth.uid() = created_by);

create policy "field_expenses_delete_authenticated"
  on public.field_expenses for delete
  to authenticated
  using (public.user_can_access_store(store_id));

create index if not exists field_expenses_date_idx on public.field_expenses (date desc);
create index if not exists field_expenses_store_id_idx on public.field_expenses (store_id);

-- --------------------------------------------------------------------------
-- 영수증 사진 저장소 (비공개 버킷 — 매장 접근 권한이 있는 사람만 업로드/조회 가능)
-- 파일 경로는 "{store_id}/{파일명}" 형태로 저장한다.
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and public.user_can_access_store((storage.foldername(name))[1]::uuid)
  );

create policy "receipts_select_authenticated"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and public.user_can_access_store((storage.foldername(name))[1]::uuid)
  );

create policy "receipts_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and public.user_can_access_store((storage.foldername(name))[1]::uuid)
  );
