# 매장 정산

Next.js 16 + Supabase 기반 매장 일 마감 · 대시보드 · 입금요청 관리 웹앱. 모바일 우선, 보라색 테마.

## 기능

- 이메일/비밀번호 로그인 · 회원가입 (사장 / 직원 역할 구분)
- 일 마감 입력: 매출, 인건비, 폐기, 특이사항 (날짜별 1건, 재입력 시 갱신)
- 대시보드: 오늘 매출 · 이익(매출 - 인건비 - 폐기), 최근 7일 매출/이익 차트, 빠른 메뉴
- 입금요청: 거래처명 · 금액 · 메모 입력 시 카카오톡 문구 실시간 자동 생성, 복사, 요청 내역 저장
- 입고 입력: 날짜 · 거래처 · 품목 메모 · 금액 · 카테고리(식재료/음료재료/소모품/기타), 오늘 입고 리스트 + 합계
- 매출 입력: 날짜별 음식매출 · 음료매출 입력(기존 일마감과 별개 테이블), 합계 자동 계산
- 주간 분석: 이번주 vs 지난주 음식/음료 매출 비교, 요일별 매출 바 차트, 주간 총 입고금액
- 실시간 코스트: 오늘/이번주 푸드코스트·음료코스트(%) — 30% 이하 초록 · 30~35% 노랑 · 35% 초과 빨강

## 시작하기

### 1. Supabase 프로젝트 준비

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다.
2. Supabase 대시보드 → **SQL Editor**에서 [`supabase/schema.sql`](supabase/schema.sql) 내용을 그대로 실행합니다.
   - `profiles`, `daily_closings`, `payment_requests`, `receipts`, `sales` 테이블과 RLS 정책, 회원가입 시 프로필 자동 생성 트리거가 만들어집니다.
   - 기존 프로젝트에 이미 스키마를 실행했다면, `receipts`/`sales` 관련 구문만 다시 실행해도 됩니다(`create table if not exists`라 안전하게 재실행 가능).
3. (선택) 개발 중 이메일 인증 없이 바로 로그인하려면 **Authentication → Providers → Email**에서 "Confirm email"을 꺼두세요. 운영 환경에서는 켜두는 것을 권장합니다.

### 2. 환경변수 설정

`.env.local.example`을 복사해 `.env.local`을 만들고 Supabase 프로젝트의 URL/anon key를 채웁니다 (Project Settings → API).

```bash
cp .env.local.example .env.local
```

### 3. 설치 및 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 → `/signup`에서 사장/직원 계정을 만들고 로그인합니다.

## 구조

- `proxy.ts` — Supabase 세션 갱신 + 비로그인 사용자를 `/login`으로 리다이렉트 (Next.js 16의 `middleware.ts` → `proxy.ts` 변경 반영)
- `lib/supabase/` — 브라우저/서버용 Supabase 클라이언트
- `app/(app)/` — 로그인 후 화면 (대시보드, 마감입력, 입금요청, 입고입력, 매출입력, 주간분석, 실시간코스트) — 공통 헤더 + 하단 탭 내비게이션 레이아웃, 대시보드의 "빠른 메뉴"에서 입고/매출/분석/코스트로 이동
- `app/login`, `app/signup` — 인증 화면
- `supabase/schema.sql` — 테이블 · RLS 정책 · 트리거

## 참고

- 매출·인건비·폐기·입금요청·입고·매출(음식/음료) 데이터는 매장 내 모든 로그인 사용자가 함께 조회합니다(단일 매장 기준). 여러 매장을 지원하려면 `stores` 테이블과 소속 관계를 추가로 설계해야 합니다.
- 날짜는 한국 표준시(KST, UTC+9) 기준으로 계산됩니다. 주간 분석/코스트는 월요일 시작 기준 주(이번주/지난주)로 계산합니다.
- `sales` 테이블은 기존 `daily_closings`(일 마감의 매출/인건비/폐기)과 별개입니다 — 음식/음료 매출을 분리 기록하고 싶을 때 `sales`를, 인건비·폐기를 포함한 하루 마감 요약이 필요할 때 `daily_closings`를 사용합니다. 두 값이 자동으로 동기화되지는 않습니다.
- 푸드/음료 코스트는 `receipts.category`(식재료/음료재료)와 `sales.food_sales`/`beverage_sales`를 기준으로 계산합니다. "이번주 평균"은 일별 비율의 평균이 아니라 주간 합계 기준(주간 입고 합계 ÷ 주간 매출 합계 × 100)입니다.
