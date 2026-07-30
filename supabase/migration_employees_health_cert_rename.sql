-- ============================================================================
-- employees.health_cert_renewed_at -> health_cert_issued_at 이름 변경
-- 보건증은 "갱신일"이 아니라 "발급일"부터 1년 유효한 것이라 컬럼명을 실제
-- 의미에 맞게 바꾼다. 데이터(날짜 값)는 그대로 유지된다.
-- ============================================================================

alter table public.employees
  rename column health_cert_renewed_at to health_cert_issued_at;
