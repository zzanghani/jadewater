import type { BoardCategory } from "@/lib/types";

export const NOTICE: BoardCategory = "공지사항";
export const WORK_CATEGORIES: BoardCategory[] = ["마케팅", "운영HR", "디자인", "R&D"];
export const ALL_CATEGORIES: BoardCategory[] = [NOTICE, ...WORK_CATEGORIES];
