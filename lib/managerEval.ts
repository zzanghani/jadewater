// 점장 분기 평가표.
//
// 직원 평가표(lib/evalRubric.ts)와 구조가 다르다. 점장은 1~5점 관찰 문항이
// 아니라 항목마다 만점이 다르고, 절반 가까이를 앱이 자동으로 채점한다.
//
// 설계 철학 — 이윤은 지분·배분 구조가 이미 강하게 보상한다(확정보수 340만 +
// 지분 20% + 상환 후 경상이윤 20%). 그래서 이 표는 이윤을 다시 보상하지 않고,
// **그 이윤을 만드는 방식이 매장을 갉아먹고 있지 않은가**를 본다.
//
// 배점 100점
//   A 자립        10  자동
//   B 자산 보존   25  일부 자동
//   C 운영 규율   10  자동
//   D 대표 관찰   35  대표
//   E 미스터리 쇼퍼 12  대행
//   F 위생·안전    8  SV

export type ManagerItem = {
  id: string;
  section: string;
  name: string;
  max: number;
  desc: string;
  // 앱이 계산해 채우는 항목. 사람이 못 고친다.
  auto?: boolean;
  // 점수 구간 설명(화면에 그대로 보여준다)
  scale?: string;
};

export const MANAGER_SECTIONS = [
  { key: "자립", weightLabel: "10점", scorer: "앱 자동" },
  { key: "자산 보존", weightLabel: "25점", scorer: "일부 자동" },
  { key: "운영 규율", weightLabel: "10점", scorer: "앱 자동" },
  { key: "대표 관찰", weightLabel: "35점", scorer: "대표" },
  { key: "미스터리 쇼퍼", weightLabel: "12점", scorer: "대행" },
  { key: "위생·안전", weightLabel: "8점", scorer: "SV" },
] as const;

export const MANAGER_ITEMS: ManagerItem[] = [
  // ── A. 자립 10 ────────────────────────────────────────────
  {
    id: "profit_months",
    section: "자립",
    name: "흑자 달성 월 수",
    max: 6,
    auto: true,
    desc: "분기 3개월 중 경상이익 흑자인 달의 수. 점장 확정보수 포함 인건비 차감 후.",
    scale: "3개월 6 / 2개월 4 / 1개월 2 / 0개월 0",
  },
  {
    id: "profit_trend",
    section: "자립",
    name: "경상이익률 개선",
    max: 4,
    auto: true,
    desc: "경상이익 ÷ 매출, 전분기 대비 증감폭. 적자여도 적자를 줄이면 점수를 받는다.",
    scale: "+2%p↑ 4 / +1~2%p 3 / ±1%p 2 / −1~2%p 1 / −2%p↓ 0",
  },

  // ── B. 자산 보존 25 ───────────────────────────────────────
  {
    id: "turnover",
    section: "자산 보존",
    name: "정직원 이탈",
    max: 4,
    auto: true,
    desc: "분기 중 퇴사한 정직원 수. 인건비를 줄이는 가장 쉬운 방법이 사람을 안 뽑는 것이다.",
    scale: "0건 4 / 1건 3 / 2건 1 / 3건↑ 0",
  },
  {
    id: "workload",
    section: "자산 보존",
    name: "근무 부하",
    max: 3,
    desc: "주 52시간 초과 근무자가 나온 주차 수. 남은 사람을 갈아넣고 있지 않은가.",
    scale: "0주 3 / 1~2주 2 / 3~5주 1 / 6주↑ 0",
  },
  {
    id: "backfill",
    section: "자산 보존",
    name: "결원 충원 속도",
    max: 3,
    desc: "퇴사 후 대체 인력 투입까지 일수. 비워둘수록 인건비율은 좋아진다.",
    scale: "30일 내 3 / 60일 내 2 / 60일 초과 0",
  },
  {
    id: "food_cost_band",
    section: "자산 보존",
    name: "식자재비율 밴드",
    max: 4,
    desc: "레시피 기준 이론 원가율을 중심으로 한 밴드. 위로 벗어나면 로스·도난, 아래로 벗어나면 정량 축소 의심. 낮을수록 좋은 항목이 아니다.",
    scale: "밴드 내 4 / ±1%p 2 / ±2%p 1 / 그 이상 0",
  },
  {
    id: "review_trend",
    section: "자산 보존",
    name: "리뷰 평점 추세",
    max: 4,
    auto: true,
    desc: "전분기 대비 평균 평점 변화. 품질 하락의 가장 빠른 신호.",
    scale: "유지·상승 4 / −0.1 3 / −0.2 1 / −0.3↓ 0",
  },
  {
    id: "facility_report",
    section: "자산 보존",
    name: "설비 이상 사전 보고",
    max: 3,
    desc: "노후·이상을 미리 보고했는가, 터진 뒤 보고했는가.",
    scale: "전건 사전 3 / 사후 1건 2 / 사후 2건 1 / 3건↑ 0",
  },
  {
    id: "facility_check",
    section: "자산 보존",
    name: "정기 점검 실시",
    max: 2,
    desc: "후드 청소, 정수기 필터, 소화기 점검 등 주기 항목.",
    scale: "전부 기한 내 2 / 1건 지연 1 / 2건↑ 0",
  },
  {
    id: "capex",
    section: "자산 보존",
    name: "승인 투자 집행",
    max: 2,
    desc: "승인된 시설 개선을 기한 내 집행했는가. 미루면 이번 달 이윤이 올라간다.",
    scale: "기한 내 2 / 1개월 지연 1 / 그 이상 0",
  },

  // ── C. 운영 규율 10 ───────────────────────────────────────
  {
    id: "closing_input",
    section: "운영 규율",
    name: "일일마감 입력",
    max: 4,
    auto: true,
    desc: "분기 중 마감을 입력한 날의 비율.",
    scale: "100% 4 / 95%↑ 3 / 90%↑ 2 / 그 이하 0",
  },
  {
    id: "weekly_report",
    section: "운영 규율",
    name: "주간보고 제출",
    max: 3,
    auto: true,
    desc: "분기 13주 중 주간보고를 작성한 주 수.",
    scale: "13주 3 / 12주 2 / 11주 1 / 10주↓ 0",
  },
  {
    id: "inventory_receipt",
    section: "운영 규율",
    name: "재고실사 · 영수증",
    max: 3,
    auto: true,
    desc: "월 1회 재고실사 실시 여부와 영수증 등록 상태.",
    scale: "3회 실시 3 / 2회 2 / 1회 1 / 0회 0",
  },

  // ── D. 대표 관찰 35 ───────────────────────────────────────
  {
    id: "team_growth",
    section: "대표 관찰",
    name: "팀 유지와 육성",
    max: 5,
    desc: "직원이 남고 자라는가. 신규 입사자를 붙잡고 가르치는가. 특정 직원에게만 일이 몰리지 않는가.",
  },
  {
    id: "reporting",
    section: "대표 관찰",
    name: "보고와 문제 해결",
    max: 5,
    desc: "사고·클레임을 즉시 보고하는가. 덮지 않는가. 같은 문제가 다음 분기에 또 나오지 않는가.",
  },
  {
    id: "execution",
    section: "대표 관찰",
    name: "지시 이행과 완결",
    max: 5,
    desc: "본사 요청을 기한 내 끝내는가. 막히면 알리는가. 두 번 말하게 하지 않는가.",
  },
  {
    id: "brand",
    section: "대표 관찰",
    name: "브랜드 기준 준수",
    max: 5,
    desc: "메뉴·서비스·프로모션을 매뉴얼대로 운영하는가. 임의로 바꾸지 않는가.",
  },
  {
    id: "leadership",
    section: "대표 관찰",
    name: "리더십과 신뢰",
    max: 5,
    desc: "직원이 점장 말을 따르는가. 점장이 없는 날에도 매장이 그대로 돌아가는가.",
  },
  {
    id: "group",
    section: "대표 관찰",
    name: "그룹 기여",
    max: 5,
    desc: "신규 출점 지원, 타 매장 인력·노하우 지원, 신메뉴·프로모션 테스트 협조. 자기 이윤에는 마이너스인 일들이라 배분 구조가 절대 못 잡는다.",
  },
  {
    id: "longterm",
    section: "대표 관찰",
    name: "장기 관점",
    max: 5,
    desc: "후임을 키우고 있는가. 매장 운영이 매뉴얼로 남아 있는가. 본인이 빠져도 3년 뒤 이 매장이 굴러가는가.",
  },

  // ── E. 미스터리 쇼퍼 12 ───────────────────────────────────
  {
    id: "ms_greeting",
    section: "미스터리 쇼퍼",
    name: "입장 응대",
    max: 2,
    desc: "문을 열고 들어선 뒤 인사·안내를 받기까지 걸린 시간.",
    scale: "10초 내 2 / 30초 내 1 / 그 이상·없음 0",
  },
  {
    id: "ms_order",
    section: "미스터리 쇼퍼",
    name: "주문 응대",
    max: 2,
    desc: "착석 후 주문을 받으러 오기까지 시간 + 알레르기·재료 질문에 답이 나오는가.",
    scale: "3분 내 + 답변 정확 2 / 하나 미흡 1 / 둘 다 0",
  },
  {
    id: "ms_serve",
    section: "미스터리 쇼퍼",
    name: "제공 시간·온도",
    max: 2,
    desc: "주문 후 첫 음식까지 분, 도착 시 온도. 메뉴별 기준 시간을 사전에 정해 둬야 한다.",
    scale: "기준 내 2 / 기준 +10분 내 1 / 그 이상·식음 0",
  },
  {
    id: "ms_plating",
    section: "미스터리 쇼퍼",
    name: "정량·플레이팅",
    max: 2,
    desc: "음식 사진을 찍어 기준 사진과 대조. 식자재비율이 낮을 때 정량 축소인지 가르는 항목.",
    scale: "일치 2 / 경미한 차이 1 / 명백히 다름 0",
  },
  {
    id: "ms_store",
    section: "미스터리 쇼퍼",
    name: "매장 상태",
    max: 2,
    desc: "테이블 이물·바닥, 화장실(냄새·비품·바닥), 근무자 유니폼·명찰.",
    scale: "전부 양호 2 / 1곳 미흡 1 / 2곳 이상 0",
  },
  {
    id: "ms_exit",
    section: "미스터리 쇼퍼",
    name: "퇴점·게시물",
    max: 2,
    desc: "계산 시 응대, 진행 중 프로모션 POP 부착, 가격표 최신 여부.",
    scale: "전부 확인 2 / 1건 미흡 1 / 2건 이상 0",
  },

  // ── F. 위생·안전 8 ───────────────────────────────────────
  {
    id: "sv_fridge",
    section: "위생·안전",
    name: "냉장·냉동고",
    max: 2,
    desc: "선입선출, 라벨·날짜 표기, 온도 기록지, 유통기한 경과 재료 없음.",
    scale: "양호 2 / 미흡 1 / 불량 0",
  },
  {
    id: "sv_kitchen",
    section: "위생·안전",
    name: "조리대·조리기구",
    max: 2,
    desc: "기름때·물때, 칼도마 구분 사용, 행주 상태, 배수구.",
    scale: "양호 2 / 미흡 1 / 불량 0",
  },
  {
    id: "sv_storage",
    section: "위생·안전",
    name: "창고·백룸",
    max: 2,
    desc: "적재 정리, 바닥 직접 적재 없음, 개인물품 분리.",
    scale: "양호 2 / 미흡 1 / 불량 0",
  },
  {
    id: "sv_safety",
    section: "위생·안전",
    name: "안전·설비 기록",
    max: 2,
    desc: "소화기 위치·검사일, 가스 차단, 칼 보관, 후드 청소·정수기 필터 교체 기록.",
    scale: "양호 2 / 미흡 1 / 불량 0",
  },
];

export const MANAGER_TOTAL = MANAGER_ITEMS.reduce((sum, i) => sum + i.max, 0);

// ────────────────────────────────────────────────────────────
// 자동 채점
// ────────────────────────────────────────────────────────────

export type ManagerAutoInput = {
  // 분기 3개월 손익
  months: { month: string; totalSales: number; netProfit: number; hasData: boolean }[];
  prevQuarterSales: number;
  prevQuarterProfit: number;
  resignedCount: number;
  reviewRatingNow: number | null;
  reviewRatingPrev: number | null;
  closingDays: number;
  quarterDays: number;
  weeklyReports: number;
  inventoryCountMonths: number;
};

export type AutoResult = {
  scores: Record<string, number>;
  notes: Record<string, string>;
};

function ratio(profit: number, sales: number): number | null {
  return sales > 0 ? (profit / sales) * 100 : null;
}

export function autoScoreManager(input: ManagerAutoInput): AutoResult {
  const scores: Record<string, number> = {};
  const notes: Record<string, string> = {};

  const withData = input.months.filter((m) => m.hasData);

  // A-1 흑자 달성 월 수
  if (withData.length === 0) {
    notes.profit_months = "정산 데이터가 없어 채점하지 않았습니다";
  } else {
    const positive = withData.filter((m) => m.netProfit > 0).length;
    scores.profit_months = positive >= 3 ? 6 : positive === 2 ? 4 : positive === 1 ? 2 : 0;
    notes.profit_months = `${withData.length}개월 집계 · 흑자 ${positive}개월`;
  }

  // A-2 경상이익률 개선
  const nowSales = withData.reduce((s, m) => s + m.totalSales, 0);
  const nowProfit = withData.reduce((s, m) => s + m.netProfit, 0);
  const nowRatio = ratio(nowProfit, nowSales);
  const prevRatio = ratio(input.prevQuarterProfit, input.prevQuarterSales);
  if (nowRatio === null || prevRatio === null) {
    notes.profit_trend = "비교할 전분기 데이터가 없어 채점하지 않았습니다";
  } else {
    const diff = nowRatio - prevRatio;
    scores.profit_trend = diff >= 2 ? 4 : diff >= 1 ? 3 : diff >= -1 ? 2 : diff >= -2 ? 1 : 0;
    notes.profit_trend = `${nowRatio.toFixed(1)}% ← 전분기 ${prevRatio.toFixed(1)}% (${
      diff >= 0 ? "+" : ""
    }${diff.toFixed(1)}%p)`;
  }

  // B-1 정직원 이탈
  const r = input.resignedCount;
  scores.turnover = r === 0 ? 4 : r === 1 ? 3 : r === 2 ? 1 : 0;
  notes.turnover = `분기 중 퇴사 ${r}명`;

  // B-2 리뷰 평점 추세
  if (input.reviewRatingNow === null || input.reviewRatingPrev === null) {
    notes.review_trend = "리뷰 통계가 없어 채점하지 않았습니다";
  } else {
    const diff = input.reviewRatingNow - input.reviewRatingPrev;
    scores.review_trend = diff >= 0 ? 4 : diff >= -0.1 ? 3 : diff >= -0.2 ? 1 : 0;
    notes.review_trend = `${input.reviewRatingNow.toFixed(2)} ← 전분기 ${input.reviewRatingPrev.toFixed(
      2
    )} (${diff >= 0 ? "+" : ""}${diff.toFixed(2)})`;
  }

  // C-1 일일마감 입력
  if (input.quarterDays > 0) {
    const rate = (input.closingDays / input.quarterDays) * 100;
    scores.closing_input = rate >= 100 ? 4 : rate >= 95 ? 3 : rate >= 90 ? 2 : 0;
    notes.closing_input = `${input.closingDays} / ${input.quarterDays}일 (${rate.toFixed(0)}%)`;
  }

  // C-2 주간보고 제출
  const w = input.weeklyReports;
  scores.weekly_report = w >= 13 ? 3 : w === 12 ? 2 : w === 11 ? 1 : 0;
  notes.weekly_report = `13주 중 ${w}주 작성`;

  // C-3 재고실사
  const inv = input.inventoryCountMonths;
  scores.inventory_receipt = inv >= 3 ? 3 : inv === 2 ? 2 : inv === 1 ? 1 : 0;
  notes.inventory_receipt = `3개월 중 ${inv}개월 실사`;

  return { scores, notes };
}

// ────────────────────────────────────────────────────────────
// 등급 · 손익 게이트
// ────────────────────────────────────────────────────────────

export type ManagerGrade = "S" | "A" | "B" | "C" | "D";

export const MANAGER_GRADE_COLOR: Record<ManagerGrade, string> = {
  S: "#15803d",
  A: "#4d7c0f",
  B: "#a16207",
  C: "#c2410c",
  D: "#b91c1c",
};

export function managerGrade(total: number): { grade: ManagerGrade; label: string } {
  if (total >= 90) return { grade: "S", label: "핵심 관리자" };
  if (total >= 80) return { grade: "A", label: "우수 성과" };
  if (total >= 70) return { grade: "B", label: "표준 수행" };
  if (total >= 60) return { grade: "C", label: "개선 필요" };
  return { grade: "D", label: "보직 재검토" };
}

// 손익 게이트 — 분기가 적자면 총점과 무관하게 S·A가 나오지 않는다.
// 점장은 매출이 어떻든 확정보수를 받는다. 하방이 막혀 있고 적자는 회사가 문다.
export function applyProfitGate(
  grade: ManagerGrade,
  quarterProfit: number,
  exempt: boolean
): { grade: ManagerGrade; gated: boolean } {
  if (exempt || quarterProfit >= 0) return { grade, gated: false };
  if (grade === "S" || grade === "A") return { grade: "B", gated: true };
  return { grade, gated: false };
}

export function managerAction(grade: ManagerGrade): string {
  if (grade === "S") return "신규 출점 지분 참여 자격(누적 2회) + 성과 상여 + 상환 가속";
  if (grade === "A") return "분기 성과 상여 + 상환 가속";
  if (grade === "B") return "유지 · 별도 조치 없음";
  if (grade === "C") return "90일 개선계획 · 출점 자격 보류 · 성과 상여 없음";
  return "보직 재검토 및 지분 환매 협의 개시";
}
