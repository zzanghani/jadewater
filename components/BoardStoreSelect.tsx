"use client";

import { useRouter } from "next/navigation";
import type { AdStore } from "@/lib/adAccess";

// 성과 확인 게시판의 매장 고르기 — 점장도 전 매장 글을 본다(주소의 store 값으로, 광고 화면 쿠키와 따로).
export default function BoardStoreSelect({ stores, current }: { stores: AdStore[]; current: string }) {
  const router = useRouter();
  if (stores.length < 2) return null;
  return (
    <select
      key={current}
      defaultValue={current}
      aria-label="매장 선택"
      onChange={(e) => router.push(`/ad-report/board?view=store&store=${e.target.value}`)}
      className="max-w-[40vw] appearance-none truncate rounded-lg border border-border bg-background py-1.5 pl-2.5 pr-6 text-xs font-semibold text-foreground outline-none ring-brand/30 focus:ring-2"
      style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5'/></svg>\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
    >
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
