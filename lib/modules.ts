// 기능 모듈 — 외부 브랜드에 팔 때의 요금 단위.
//
// 기본 기능(여기 목록에 없는 모든 화면)은 기본 요금에 포함되고, 아래 모듈은
// 브랜드가 월 결제로 추가한다. 포스(토스) 연동은 API 키 한 번 꽂으면 끝나는
// 일이라 따로 받지 않고 기본에 넣었다(2026-11-01 대표님 결정). 어느 브랜드가 무엇을 켰는지는 DB brand_modules
// (supabase/migration_brand_modules.sql)에 있고, 결제가 붙기 전까지는 본사
// 마스터가 /modules 화면에서 손으로 켜고 끈다.
//
// 적용 범위: 매장 계정(지점장·직원)만 잠근다. 본사(마스터·팀 계정)는 운영사라
// 항상 전부 본다.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export type ModuleKey = "finance" | "hr" | "marketing" | "recruit";

export type ModuleInfo = {
  key: ModuleKey;
  name: string;
  summary: string;
  /** 이 모듈에 속한 화면(경로 접두사). 여기 없는 경로는 기본 기능. */
  paths: string[];
  /** 모듈 안에 들어 있는 기능 이름(안내 화면용) */
  features: string[];
  /** 매장당 월 요금 초안(원). 확정 전 — 안내 화면에는 "초안"으로 표시. */
  priceMonthly: number;
};

export const MODULES: ModuleInfo[] = [
  {
    key: "finance",
    name: "정산·급여",
    summary: "월말 손익과 급여 신고, 투자 상환 관리",
    paths: ["/settlement", "/payroll", "/loans"],
    features: ["월말정산(매장별 손익·플랫폼 수수료·본사 적립)", "급여신고(노무법인·세무사 메일 전송)", "금전대차(투자·상환 이력)"],
    priceMonthly: 20000,
  },
  {
    key: "hr",
    name: "인사·평가",
    summary: "GPS 출퇴근, 직원 명단·보건증·입퇴사, 점장 평가와 자기평가",
    paths: ["/attendance", "/hr", "/my-review"],
    features: [
      "GPS 출퇴근(매장 반경 안에서만 기록, 지각·조퇴·결근 자동 표시, 출퇴근 전 알림)",
      "직원 명단·입퇴사·보건증 관리",
      "점장 평가표",
      "직원 자기평가·확정 결과 열람",
    ],
    priceMonthly: 10000,
  },
  {
    key: "marketing",
    name: "리뷰·광고 자동화",
    summary: "매일 아침 리뷰 수집·AI 요약, 네이버 광고 성과 분석·조정",
    paths: ["/review-report", "/ad-report"],
    features: ["구글 평점·리뷰, 블로그 후기 자동 수집과 요약", "네이버 검색광고 주간 리포트·시간대 효율", "캠페인 ON/OFF·예산 조정·손익분기·검색 노출 순위"],
    priceMonthly: 30000,
  },
  {
    key: "recruit",
    name: "체험단 운영",
    summary: "리뷰노트 체험단 모집글·지원자 점수·선정·방문 추적",
    paths: ["/recruit"],
    features: ["모집글 AI 초안", "지원자 블로그 점수(A/B/C)와 선정", "선정자 안내 문자·셀프 방문 예약·리뷰 등록 추적"],
    priceMonthly: 20000,
  },
];

export const MODULE_BY_KEY = Object.fromEntries(MODULES.map((m) => [m.key, m])) as Record<ModuleKey, ModuleInfo>;

/** 경로가 어느 모듈에 속하는지. 기본 기능이면 null. */
export function moduleForPath(pathname: string): ModuleKey | null {
  const path = pathname.split("?")[0];
  for (const m of MODULES) {
    if (m.paths.some((p) => path === p || path.startsWith(p + "/"))) return m.key;
  }
  return null;
}

/**
 * 지금 켜져 있는 모듈 키 목록(체험 중이면 기한 안인 것만).
 * brand_modules 테이블이 아직 없는 환경(마이그레이션 전)에서는 조회가 실패하는데,
 * 그때 매장 계정의 메뉴가 통째로 사라지면 안 되므로 null(제한 없음)을 돌려준다.
 */
export async function loadActiveModules(
  supabase: SupabaseClient<Database>,
  brandId: string | null | undefined
): Promise<ModuleKey[] | null> {
  if (!brandId) return [];
  const { data, error } = await supabase
    .from("brand_modules")
    .select("module_key, status, trial_ends_at")
    .eq("brand_id", brandId);
  if (error) {
    console.error("[modules] brand_modules 조회 실패 — 제한 없이 표시", error.message);
    return null;
  }
  const now = Date.now();
  return (data ?? [])
    .filter((r) => r.status === "active" || (r.status === "trial" && (!r.trial_ends_at || new Date(r.trial_ends_at).getTime() > now)))
    .map((r) => r.module_key as ModuleKey)
    .filter((k) => k in MODULE_BY_KEY);
}

/** 메뉴 항목이 보여야 하는지 — 기본 기능이거나 모듈이 켜져 있으면 true. */
export function pathAllowed(pathname: string, active: readonly ModuleKey[] | null | undefined): boolean {
  // active 가 null/undefined 면 "제한 없음"(본사 계정).
  if (!active) return true;
  const key = moduleForPath(pathname);
  return !key || active.includes(key);
}
