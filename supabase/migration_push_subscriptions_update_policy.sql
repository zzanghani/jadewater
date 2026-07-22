-- ============================================================================
-- 같은 기기(같은 push 구독 endpoint)를 다른 계정으로 재등록할 때 실패하는 문제 수정
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- push_subscriptions는 endpoint가 unique라서, 이미 등록된 기기가 다른 계정으로
-- 재구독하면 upsert가 insert가 아니라 update로 처리된다. 지금까지 UPDATE 정책이
-- 없어서 예전 계정 소유였던 구독을 새 계정으로 넘겨받는 게 RLS에 막혀 있었다.
--
-- 기존 소유자와 무관하게(using true) 재등록 자체는 허용하되, 결과 값은 항상
-- "로그인한 본인 + 접근 가능한 매장"이어야 하도록 with check로 제한한다
-- (insert 정책과 동일한 기준).
-- ============================================================================

drop policy if exists "push_subscriptions_update_authenticated" on public.push_subscriptions;
create policy "push_subscriptions_update_authenticated"
  on public.push_subscriptions for update
  to authenticated
  using (true)
  with check (auth.uid() = user_id and public.user_can_access_store(store_id));
