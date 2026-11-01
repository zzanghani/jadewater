// 기능 모듈 — 외부 브랜드에 팔 때의 요금 단위.
//
// 기본 기능(여기 목록에 없는 모든 화면)은 기본 요금에 포함되고, 아래 모듈은
// 브랜드가 월 결제로 추가한다. 어느 브랜드가 무엇을 켰는지는 DB brand_modules
// (supabase/migration_brand_modules.sql)에 있고, 결제가 붙기 전까지는 본사
// 마스터가 /modules 화면에서 손으로 켜고 끈다.
//
// 적용 범위: 매장 계정(지점장·직원)만 잠근다. 본사(마스터·팀 계정)는 운영사라
// 항상 전부 본다.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export type ModuleKey = "finance" | "hr" | "marketing" | "recruit" | "pos";

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
    summary: "직원 명단·보건증·입퇴사, 점장 평가와 자기평가",
    paths: ["/hr", "/my-review"],
    features: ["직원 명단·입퇴사·보건증 관리", "점장 평가표", "직원 자기평가·확정 결과 열람"],
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
  {
    key: "pos",
    name: "포스 연동",
    summary: "토스포스 결제 데이터로 실시간 매출과 마감 자동 입력",
    paths: ["/toss", "/live"],
    features: ["홈 실시간 매출(결제+미결제)", "마감 자동 입력", "메뉴별 판매 분석"],
    priceMonthly: 10000,
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

/** 지금 켜져 있는 모듈 키 목록(체험 중이면 기한 안인 것만). */
export async function loadActiveModules(
  supabase: SupabaseClient<Database>,
  brandId: string | null | undefined
): Promise<ModuleKey[]> {
  if (!brandId) return [];
  const { data } = await supabase
    .from("brand_modules")
    .select("module_key, status, trial_ends_at")
    .eq("brand_id", brandId);
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
