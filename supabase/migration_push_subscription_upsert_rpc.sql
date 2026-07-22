-- ============================================================================
-- 기기 재구독(다른 계정 소유였던 endpoint를 넘겨받는 것) upsert가
-- "row-level security policy (USING expression)" 오류로 실패하는 문제 수정
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- 원인: INSERT ... ON CONFLICT DO UPDATE 방식의 upsert는, 충돌 대상인 기존
-- 행이 현재 사용자에게 SELECT 정책상 "보이지 않으면"(다른 매장 소유였다면)
-- RLS가 충돌 해소 자체를 막아버린다. UPDATE 정책의 using을 true로 풀어도
-- 이 특성 때문에 해결되지 않는다.
--
-- 해결: 인증/매장 접근 권한 검사를 함수 안에서 직접 수행하는
-- SECURITY DEFINER 함수로 upsert를 감싸서, 테이블 RLS 자체를 우회한다.
-- ============================================================================

create or replace function public.upsert_push_subscription(
  p_store_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.user_can_access_store(p_store_id) then
    raise exception 'access denied for store';
  end if;

  insert into public.push_subscriptions (user_id, store_id, endpoint, p256dh, auth)
  values (auth.uid(), p_store_id, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        store_id = excluded.store_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth;
end;
$$;

grant execute on function public.upsert_push_subscription(uuid, text, text, text) to authenticated;
