-- ============================================================================
-- 1:1 메시지(direct_messages)를 직원(staff) 계정은 같은 매장 사람(지점장
-- 포함)에게만 보낼 수 있게 제한한다. 지점장·마스터·본사 팀 계정은 지금
-- 처럼 제한 없이 아무나와 메시지를 주고받을 수 있다.
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요. 그린/블루 두
-- 프로젝트 모두 각각 실행해야 합니다. migration_employee_accounts.sql이
-- 먼저 실행되어 있어야 합니다.
-- ============================================================================

create or replace function public.user_can_dm(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and (
        -- 직원(staff)이 아니면 지금처럼 아무나와 대화 가능
        not (me.department is null and me.store_id is not null and me.role = 'staff')
        or exists (
          -- 직원이면 같은 매장 사람(지점장 포함)만
          select 1 from public.profiles other
          where other.id = target_user_id
            and other.department is null
            and other.store_id = me.store_id
        )
      )
  );
$$;

drop policy if exists "direct_messages_insert_own" on public.direct_messages;
create policy "direct_messages_insert_own"
  on public.direct_messages for insert
  to authenticated
  with check (auth.uid() = sender_id and public.user_can_dm(recipient_id));
