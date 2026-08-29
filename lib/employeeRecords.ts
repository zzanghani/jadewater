// 사건 기록에 붙는 "평가 문항" 태그 목록.
//
// 분기 말 근무평가 채점 화면에서 문항별로 기록을 모아 보여주기 위한 것이라,
// 여기 이름이 곧 평가표 문항 이름이어야 한다. 근무평가표 엑셀(26.07.22)의
// 정직원(홀)/정직원(주방) 문항을 기준으로 하되, 근태는 앱이 자동 채점하므로
// 태그 대상에서 빼고 "용모 및 위생"만 남겼다.

import { kstDateString } from "./date";
import type { EmployeeTeam } from "./types";

export const EVAL_ITEMS_HALL = [
  "용모 및 위생",
  "업무 성실성",
  "고객 및 컴플레인 응대",
  "메뉴 지식 및 가이드",
  "제안 및 업셀링",
  "테이블 및 위생 관리",
  "주문 및 결제 숙련도",
  "주도성 및 책임감",
  "팀워크 및 상호 협력",
  "주방과의 소통 및 조율",
  "능동적 업무 태도 및 문제 해결",
] as const;

export const EVAL_ITEMS_KITCHEN = [
  "용모 및 개인위생",
  "업무 성실성",
  "위생 및 청결 관리",
  "레시피 및 매뉴얼 숙지",
  "조리 속도 및 생산성",
  "업무 숙련도 및 준비(Prep)",
  "식자재 및 재고 관리",
  "주방·홀 소통 (주문 및 안전)",
  "팀워크 및 상호 협력",
  "주도성 및 책임감",
] as const;

// 팀이 정해지지 않은 사람(MSO 소속 등)에게 쓰는 공통 목록.
export const EVAL_ITEMS_COMMON = [
  "용모 및 위생",
  "업무 성실성",
  "주도성 및 책임감",
  "팀워크 및 상호 협력",
  "능동적 업무 태도 및 문제 해결",
] as const;

export function evalItemsFor(team: EmployeeTeam | null): readonly string[] {
  if (team === "홀") return EVAL_ITEMS_HALL;
  if (team === "키친") return EVAL_ITEMS_KITCHEN;
  return EVAL_ITEMS_COMMON;
}

// AI가 엉뚱한 문자열을 뱉었을 때 저장하지 않도록 목록 안의 값인지 확인한다.
export function normalizeEvalItem(
  value: string | null | undefined,
  team: EmployeeTeam | null
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return evalItemsFor(team).includes(trimmed) ? trimmed : null;
}

// 사건 기록은 분기 단위로 모아 본다 — 근무평가 주기와 같아야 채점 화면에
// 그대로 붙는다.
export function currentQuarterRange(): { period: string; label: string; start: string; end: string } {
  const today = kstDateString(0);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const quarter = Math.ceil(month / 3);
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const endDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    period: `${year}-Q${quarter}`,
    label: `${year}년 ${quarter}분기`,
    start: `${year}-${pad(startMonth)}-01`,
    end: `${year}-${pad(endMonth)}-${pad(endDay)}`,
  };
}
