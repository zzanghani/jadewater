import type { Department } from "./types";

// 베스트메이트컴퍼니 본사 팀 5명(마스터 + 4개 부서) 고정 색상.
// 월간계획 캘린더에서 "누가 만든 일정인지" 한눈에 구분하기 위해 씀.
const DEPARTMENT_COLORS: Record<Department | "master", string> = {
  master: "#3457d5",
  marketing: "#db2777",
  ops: "#0891b2",
  rnd: "#7c3aed",
  design: "#ea580c",
};

export function departmentColor(department: Department | null | undefined): string {
  return DEPARTMENT_COLORS[department ?? "master"];
}
