-- ============================================================================
-- 게시판 업무 담당자 지정 + 발제자/담당자 완료 체크
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
--
-- assignee_id가 지정된 글은 "업무" 성격으로 보고, 발제자(작성자)와
-- 담당자 둘 다 체크하면 completed_at이 채워져 목록에서 사라진다
-- (payment_requests의 completed_at 패턴과 동일).
-- ============================================================================

alter table public.board_posts
  add column if not exists assignee_id uuid references public.profiles (id),
  add column if not exists requester_confirmed boolean not null default false,
  add column if not exists assignee_confirmed boolean not null default false,
  add column if not exists completed_at timestamptz;

-- 발제자 본인 또는 담당자 본인만 확인 체크를 업데이트할 수 있다.
create policy "board_posts_update_participant"
  on public.board_posts for update
  to authenticated
  using (auth.uid() = created_by or auth.uid() = assignee_id)
  with check (auth.uid() = created_by or auth.uid() = assignee_id);

create index if not exists board_posts_completed_at_idx on public.board_posts (completed_at);
