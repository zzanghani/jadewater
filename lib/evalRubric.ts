// 정직원 근무평가 배점표 — 실제 사용 중인 "근무평가표" 엑셀의 정직원(홀)/
// 정직원(주방) 시트 내용을 그대로 옮긴 것. 항목/문항은 사람이 아니라
// 코드에 고정해 두고, 사람별/분기별 채점 결과만 DB에 저장한다.
// (매달 하기엔 부담스럽다는 피드백으로 분기 단위로 바꿨다 — period 값의
// 형식만 'YYYY-MM'에서 'YYYY-Q1'로 바뀌는 거라 DB 스키마 변경은 없다.)

import { kstDateString } from "./date";

export type EvalItem = {
  id: string;
  category: string;
  name: string;
  desc: string;
};

export const EVAL_RUBRIC_HALL: EvalItem[] = [
  {
    id: "attendance",
    category: "태도",
    name: "근태 및 용모 규정 준수",
    desc: "지각·결근이 없으며, 용모 및 단정한 유니폼 착용 등 고객을 맞이하는 개인 위생 상태가 청결한가?",
  },
  {
    id: "diligence",
    category: "태도",
    name: "업무 성실성",
    desc: "관리자의 오더에 잘 따르고, 업무 시 컨디션 관리를 잘 하는가? (개인적인 문제로 업무에 차질이 없는가?)",
  },
  {
    id: "complaint",
    category: "서비스/직무",
    name: "고객 및 컴플레인 응대",
    desc: "고객에게 밝은 미소로 응대하고, 불만(컴플레인) 발생 시 즉시 상급자에게 보고 및 매뉴얼에 따라 유연하게 대처하는가?",
  },
  {
    id: "menu_knowledge",
    category: "서비스/직무",
    name: "메뉴 지식 및 가이드",
    desc: "메뉴 특징, 알레르기 정보, 레시피 등을 숙지하여 고객에게 친절히 설명하고, 니즈에 맞는 선택을 하도록 돕는가?",
  },
  {
    id: "table_hygiene",
    category: "서비스/직무",
    name: "테이블 및 위생 관리",
    desc: "빈 그릇 치우기, 세팅, 물 리필 등 테이블과 식기류의 위생 수칙을 준수하며 고객의 필요에 미리 대응하는가?",
  },
  {
    id: "pos_skill",
    category: "서비스/직무",
    name: "주문 및 결제 숙련도",
    desc: "POS 주문 처리, 결제, 서비스 프로세스 등 홀의 전반적인 업무 속도가 빠르고 정확한가?",
  },
  {
    id: "ownership",
    category: "협업/소통",
    name: "주도성 및 책임감",
    desc: "프로세스(오픈, 미들, 마감)를 지키고 필요한 일을 스스로 찾아 하며 업무를 끝까지 완수하는가?",
  },
  {
    id: "teamwork",
    category: "협업/소통",
    name: "팀워크 및 상호 협력",
    desc: "동료와 필요한 정보(고객 요청, 특이사항 등)를 명확히 공유하고, 바쁜 포지션이 있으면 서로 적극적으로 돕는가?",
  },
  {
    id: "kitchen_comm",
    category: "협업/소통",
    name: "주방과의 소통 및 조율",
    desc: "주문 누락이나 변경 사항 발생 시 주방(BOH)에 정확하고 신속하게 전달하여 홀과 주방 간의 매끄러운 운영을 돕는가?",
  },
  {
    id: "problem_solving",
    category: "협업/소통",
    name: "능동적 업무 태도 및 문제 해결",
    desc: "현장 상황을 상시 주시하며, 예기치 못한 돌발 상황이나 필요한 지시 사항에 능동적이고 유연하게 대처하는가?",
  },
];

export const EVAL_RUBRIC_KITCHEN: EvalItem[] = [
  {
    id: "attendance",
    category: "태도",
    name: "근태 및 용모 규정준수",
    desc: "지각·결근이 없으며, 주방 유니폼 착용 및 개인 위생(포함 손, 머리 등) 상태를 청결하게 유지하는가?",
  },
  {
    id: "diligence",
    category: "태도",
    name: "업무 성실성",
    desc: "관리자의 오더에 잘 따르고, 업무 시 컨디션 관리를 잘 하는가? (개인적인 문제로 업무에 차질이 없는가?)",
  },
  {
    id: "hygiene",
    category: "직무",
    name: "위생 및 청결 관리",
    desc: "조리대, 조리기구, 싱크대 등의 위생 수칙을 엄격히 준수하며 마감 청소 및 설거지에 적극적인가?",
  },
  {
    id: "recipe",
    category: "직무",
    name: "레시피 및 매뉴얼 숙지",
    desc: "교육받은 정해진 레시피, 정량, 메뉴 구성 및 조리 프로세스를 정확히 이해하고 준수하여 일정한 맛과 퀄리티를 유지하는가?",
  },
  {
    id: "speed",
    category: "직무",
    name: "조리 속도 및 생산성",
    desc: "피크 타임에 주문이 밀리지 않도록 신속하고 정확하게 음식을 완성하는가?",
  },
  {
    id: "prep",
    category: "직무",
    name: "업무 숙련도 및 준비(Prep)",
    desc: "대기 시간이나 스윙타임(비피크 타임)을 활용하여 재료 준비(prep)를 철저히 하고, 저녁 영업을 능동적으로 대비하는가?",
  },
  {
    id: "inventory",
    category: "직무",
    name: "식자재 및 재고 관리",
    desc: "식재료 보관 수칙(선입선출)을 철저히 준수하고, 재료 로스 최소화 및 재고 부족 시 미리 공유하는가?",
  },
  {
    id: "safety_comm",
    category: "협업/공통",
    name: "주방·홀 소통 (주문 및 안전)",
    desc: "홀의 주문 정보(Call)에 정확히 응답하며, 주방 내 위험 요소(칼, 불 등)를 팀원 간 상시 공유하여 안전을 확보하는가?",
  },
  {
    id: "teamwork",
    category: "협업/공통",
    name: "팀워크 및 상호 협력",
    desc: "동료와 필요한 정보를 명확히 공유하고, 바쁘거나 일손이 부족할 때 서로 적극적으로 돕는가?",
  },
  {
    id: "ownership",
    category: "협업/공통",
    name: "주도성 및 책임감",
    desc: "프로세스(오픈, 미들, 마감)를 잘 지키고 필요한 일을 스스로 찾아 하며 업무를 끝까지 완수하는가?",
  },
];

export function evalRubricFor(team: "홀" | "키친"): EvalItem[] {
  return team === "홀" ? EVAL_RUBRIC_HALL : EVAL_RUBRIC_KITCHEN;
}

export type EvalGrade = "S" | "A" | "B" | "C" | "D";

export const GRADE_COLOR: Record<EvalGrade, string> = {
  S: "#15803d",
  A: "#65a30d",
  B: "#ca8a04",
  C: "#ea580c",
  D: "#dc2626",
};

// 정직원 근무평가 등급 기준(45~50=S ... 10~29=C) — 실제 평가표의
// "재계약/연봉조정가이드라인" 표를 그대로 옮김. 10점 미만(D)은 표에
// 없지만 다른 직급 평가표와 같은 기준으로 최하 등급을 매긴다.
export function evalGrade(total: number): { grade: EvalGrade; label: string; comp: string } {
  if (total >= 45) return { grade: "S", label: "핵심인재", comp: "+6%" };
  if (total >= 40) return { grade: "A", label: "우수성과", comp: "+4%" };
  if (total >= 30) return { grade: "B", label: "표준적 성과 수행", comp: "+2%" };
  if (total >= 10) return { grade: "C", label: "일부개선 필요", comp: "동결" };
  return { grade: "D", label: "재계약 재검토 필요", comp: "재검토" };
}

// 근무평가/동료 한마디 모두 분기 단위('YYYY-Q1'~'YYYY-Q4')로 돈다.
export function currentEvalPeriod(): string {
  const today = kstDateString(0);
  const year = today.slice(0, 4);
  const month = Number(today.slice(5, 7));
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

export function evalPeriodLabel(period: string): string {
  const [year, q] = period.split("-Q");
  return `${year}년 ${q}분기`;
}
