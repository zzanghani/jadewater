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

alter table public.profiles
  add column if not exists deleted_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('pending', 'approved', 'rejected', 'deleted'));

comment on column public.profiles.deleted_at is
  '앱에서 계정 삭제(탈퇴)를 완료한 시각. 이 값이 있으면 status = deleted 이고 개인정보는 익명화된 상태';
