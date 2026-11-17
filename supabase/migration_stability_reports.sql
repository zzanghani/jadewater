-- 앱 점검(안정화) 결과를 앱 안에서 대표가 보고 피드백할 수 있게 한다.
--
-- 매일 06:00 아침 점검 루틴이 결과(결론·고친 것·할 일·전체 보고서)를
-- /api/cron/stability-report 로 올리면 stability_reports 에 날짜별 한 행으로 쌓인다.
-- 대표(본사 마스터)는 /stability 화면에서 그날 점검을 '확인'하고(checked_at),
-- 고칠 점·궁금한 점을 stability_feedback 에 남긴다. 다음 날 루틴이 피드백을 읽어
-- 반영하고 reply/status 로 답을 남긴다.
--
-- 읽기·쓰기는 본사 마스터(user_is_master: store_id·department 없음)만. 루틴은 서비스 키.
-- 멱등: 여러 번 실행해도 안전.

create table if not exists public.stability_reports (
  date date primary key,
  verdict text not null default '정상' check (verdict in ('정상', '경고', '이상')),
  summary text not null,
  fixed text,
  todo text,
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  checked_at timestamptz,
  checked_by uuid references public.profiles(id) on delete set null
);

comment on table public.stability_reports is '아침 자동 점검 결과(날짜별 1행). 루틴이 올리고 대표가 확인한다.';
comment on column public.stability_reports.verdict is '정상 | 경고 | 이상';
comment on column public.stability_reports.summary is '결론 한 줄(한국어)';
comment on column public.stability_reports.fixed is '그날 고쳐서 그린에 올린 것';
comment on column public.stability_reports.todo is '대표가 직접 할 일';
comment on column public.stability_reports.detail is '전체 보고서(마크다운)';
comment on column public.stability_reports.checked_at is '대표가 앱에서 확인 표시한 시각';

create table if not exists public.stability_feedback (
  id uuid primary key default gen_random_uuid(),
  report_date date references public.stability_reports(date) on delete set null,
  body text not null check (length(body) between 1 and 2000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'done')),
  reply text,
  replied_at timestamptz
);

comment on table public.stability_feedback is '점검 결과에 대한 대표 피드백. 다음 점검 루틴이 읽고 reply/status 로 답한다.';

create index if not exists stability_feedback_open_idx
  on public.stability_feedback (status, created_at desc);

alter table public.stability_reports enable row level security;
alter table public.stability_feedback enable row level security;

drop policy if exists "stability_reports_select_master" on public.stability_reports;
create policy "stability_reports_select_master"
  on public.stability_reports for select
  to authenticated
  using (public.user_is_master());

drop policy if exists "stability_reports_update_master" on public.stability_reports;
create policy "stability_reports_update_master"
  on public.stability_reports for update
  to authenticated
  using (public.user_is_master())
  with check (public.user_is_master());

drop policy if exists "stability_feedback_select_master" on public.stability_feedback;
create policy "stability_feedback_select_master"
  on public.stability_feedback for select
  to authenticated
  using (public.user_is_master());

drop policy if exists "stability_feedback_insert_master" on public.stability_feedback;
create policy "stability_feedback_insert_master"
  on public.stability_feedback for insert
  to authenticated
  with check (public.user_is_master() and created_by = auth.uid());

drop policy if exists "stability_feedback_update_master" on public.stability_feedback;
create policy "stability_feedback_update_master"
  on public.stability_feedback for update
  to authenticated
  using (public.user_is_master())
  with check (public.user_is_master());
