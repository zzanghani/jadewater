-- ============================================================================
-- 매장이 입금요청을 올리면 마스터 계정에도 푸시 알림이 가도록 확장
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 마스터 계정의 구독은 특정 매장에 속하지 않으므로 store_id를 NULL로 저장한다
-- (profiles.store_id가 NULL이면 마스터라는 기존 규칙과 동일한 패턴).
-- ============================================================================

alter table public.push_subscriptions alter column store_id drop not null;

drop policy if exists "push_subscriptions_select_authenticated" on public.push_subscriptions;
create policy "push_subscriptions_select_authenticated"
  on public.push_subscriptions for select
  to authenticated
  using (store_id is null or public.user_can_access_store(store_id));

drop policy if exists "push_subscriptions_delete_authenticated" on public.push_subscriptions;
create policy "push_subscriptions_delete_authenticated"
  on public.push_subscriptions for delete
  to authenticated
  using (store_id is null or public.user_can_access_store(store_id));

-- insert 정책은 그대로 둔다: user_can_access_store(NULL)은 프로필의
-- store_id가 NULL인 마스터 계정에서만 true가 되므로, 매장 계정이 store_id를
-- NULL로 구독을 만드는 건 여전히 막힌다.
