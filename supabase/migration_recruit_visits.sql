-- ============================================================================
-- 체험단 "선정 이후" 흐름 — 방문 예약 → 방문 완료 → 리뷰 등록까지 앱에서 본다.
--
-- recruit_applicants (선정자마다)
--   visit_at / visit_party / visit_note : 점장이 잡은 방문 예정(일시·인원·메모)
--   visited_at                           : 방문 완료 체크 시각
--   no_show                              : 예약하고 안 온 사람
--   review_url / review_at / review_ranks: 리뷰노트에서 맥미니가 읽어온 리뷰 등록 여부·키워드 순위
--   rn_status                            : 리뷰노트 쪽 상태(APPROVED 등)
-- recruit_rounds
--   review_end_at      : 리뷰 마감(리뷰노트 reviewEndAt)
--   progress_synced_at : 맥미니가 마지막으로 리뷰 현황을 맞춘 시각
-- 여러 번 실행해도 안전합니다. migration_recruit_macmini.sql 이후에 실행.
-- ============================================================================

alter table public.recruit_applicants
  add column if not exists visit_at timestamptz,
  add column if not exists visit_party integer,
  add column if not exists visit_note text,
  add column if not exists visited_at timestamptz,
  add column if not exists no_show boolean not null default false,
  add column if not exists review_url text,
  add column if not exists review_at timestamptz,
  add column if not exists review_ranks jsonb,
  add column if not exists rn_status text;

alter table public.recruit_rounds
  add column if not exists review_end_at timestamptz,
  add column if not exists progress_synced_at timestamptz;

create index if not exists recruit_applicants_visit_idx
  on public.recruit_applicants (store_id, visit_at) where selected;
