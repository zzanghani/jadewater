"use client";

import { useRef } from "react";
import { selectAdStore } from "@/app/actions/adStore";
import type { AdStore } from "@/lib/adAccess";

// 광고 화면 머리글의 매장 고르기. 볼 수 있는 매장이 둘 이상일 때만 보인다.
// 고르면 쿠키에 적히고 광고 화면들(효율 분석·관리·검색 노출·시간대)이 같은 매장으로 따라간다.
export default function AdStoreSelect({ stores, current }: { stores: AdStore[]; current: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  if (stores.length < 2) return null;
  return (
    <form ref={formRef} action={selectAdStore}>
      <select
        key={current}
        name="store_id"
        defaultValue={current}
        aria-label="매장 선택"
        onChange={() => formRef.current?.requestSubmit()}
        className="max-w-[40vw] appearance-none truncate rounded-lg border border-border bg-background py-1.5 pl-2.5 pr-6 text-xs font-semibold text-foreground outline-none ring-brand/30 focus:ring-2"
        style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5'/></svg>\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </form>
  );
}
