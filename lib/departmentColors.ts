import type { Department } from "./types";

// 베스트메이트컴퍼니 본사 팀 5명(마스터 + 4개 부서) 고정 색상.
// 월간계획 캘린더에서 "누가 만든 일정인지" 한눈에 구분하기 위해 씀.
const DEPARTMENT_COLORS: Record<Department | "master", string> = {
  master: "#dc2626", // 빨강
  marketing: "#f97316", // 오렌지
  design: "#16a34a", // 녹색
  ops: "#2563eb", // 파랑
  rnd: "#ca8a04", // 노랑(흰 글씨 가독성 위해 살짝 어두운 톤)
};

export function departmentColor(department: Department | null | undefined): string {
  return DEPARTMENT_COLORS[department ?? "master"];
}
