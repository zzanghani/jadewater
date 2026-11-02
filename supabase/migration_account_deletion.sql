-- 앱 내 계정 삭제(회원 탈퇴) 지원
--
-- 스토어 심사(애플 5.1.1(v), 구글 플레이 데이터 삭제 정책)는 앱 안에서 계정을
-- 지울 수 있어야 한다. 그런데 profiles.id는 마감·입고·게시판 등 60개 가까운
-- 업무 기록의 created_by가 참조하고 있어(on delete no action) 행을 실제로
-- 지울 수 없고, 지워서도 안 된다(회사의 회계·노무 기록). 그래서 탈퇴는
--   1) 프로필을 익명화(이름 '탈퇴한 사용자', 이메일·사진·소속 제거)
--   2) 로그인 계정(auth.users)은 이메일을 무작위 값으로 바꾸고 영구 차단
-- 으로 처리하고, 그 상태를 status = 'deleted' + deleted_at 으로 남긴다.
-- (앱 서버 액션 app/actions/account.ts 참고)
--
-- 2026-11-03: DB 쪽 정리(알림 구독·출퇴근 알림·팔로우·채팅방 멤버 삭제 + 프로필
-- 익명화)를 RPC delete_account_data 한 번으로 묶었다. 한 트랜잭션이라 중간에
-- 실패하면 아무것도 안 바뀐다. (블루에 코드만 먼저 올라가고 이 SQL이 안 들어간
-- 상태에서, 앞 단계만 지워지고 익명화는 실패하는 일이 있었다.)

alter table public.profiles
  add column if not exists deleted_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('pending', 'approved', 'rejected', 'deleted'));

comment on column public.profiles.deleted_at is
  '앱에서 계정 삭제(탈퇴)를 완료한 시각. 이 값이 있으면 status = deleted 이고 개인정보는 익명화된 상태';

-- 탈퇴 처리의 DB 부분 전체. 서비스 롤(앱 서버)만 호출한다 — 본인 비밀번호
-- 재확인은 앱이 먼저 한다. 돌려주는 값은 지워야 할 프로필 사진 경로.
create or replace function public.delete_account_data(target_user uuid, anonymized_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  old_avatar text;
  cur_status text;
begin
  select status, avatar_path into cur_status, old_avatar
  from public.profiles where id = target_user for update;
  if cur_status is null then
    raise exception 'profile not found';
  end if;
  if cur_status = 'deleted' then
    return null;
  end if;

  -- 개인 설정 정리 — 알림이 더 가지 않게, 채팅방·팔로우 목록에서 빠지게.
  delete from public.push_subscriptions where user_id = target_user;
  delete from public.attendance_reminders where user_id = target_user;
  delete from public.board_post_followers where user_id = target_user;
  delete from public.monthly_plan_followers where user_id = target_user;
  delete from public.chat_room_members where user_id = target_user;

  -- 프로필 익명화 (업무 기록의 created_by 는 그대로 이 id 를 가리킨다)
  update public.profiles set
    name = '탈퇴한 사용자',
    email = anonymized_email,
    avatar_path = null,
    store_id = null,
    department = null,
    role = 'staff',
    status = 'deleted',
    deleted_at = now()
  where id = target_user;

  return old_avatar;
end;
$$;

revoke all on function public.delete_account_data(uuid, text) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid, text) to service_role;
