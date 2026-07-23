import type { ScheduleRole } from "@/lib/types";

export const SCHEDULE_ROLES: ScheduleRole[] = ["점장", "부점장", "팀장", "사원", "파트타이머"];

const ROLE_COLORS: Record<ScheduleRole, string> = {
  점장: "#DC2626",
  부점장: "#EA580C",
  팀장: "#7C3AED",
  사원: "#2563EB",
  파트타이머: "#059669",
};

export function roleColor(role: ScheduleRole): string {
  return ROLE_COLORS[role];
}
