-- ============================================================================
-- 체험단 맥미니 작업기 연동 — 회차에 "맥미니가 마지막으로 한 일/오류"를 남긴다.
-- 점장이 /recruit 화면에서 "리뷰노트 등록됨 / 지원자 32명 가져옴 / 선정 반영 실패: …"를 본다.
-- 여러 번 실행해도 안전합니다.
-- ============================================================================

alter table public.recruit_rounds
  add column if not exists macmini_note text,
  add column if not exists macmini_at timestamptz;

-- 지원자 행에 리뷰노트 지원 번호(applyId)를 바로 꺼내 쓸 수 있게 (rn jsonb 안에도 있음).
alter table public.recruit_applicants
  add column if not exists apply_id text;

create index if not exists recruit_applicants_apply_idx on public.recruit_applicants (apply_id);
