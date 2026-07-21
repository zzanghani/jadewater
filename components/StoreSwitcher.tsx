"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { selectStore } from "@/app/actions/store";
import type { Store } from "@/lib/types";

export default function StoreSwitcher({
  stores,
  current,
}: {
  stores: Store[];
  current: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const pathname = usePathname();

  if (stores.length === 0) return null;

  // 마스터 계정(매장이 여러 개 보이는 계정)은 월말정산 화면에서만 매장 선택이 필요하다.
  if (stores.length > 1 && !pathname.startsWith("/settlement")) {
    return null;
  }

  if (stores.length === 1) {
    return (
      <div className="border-t border-border px-4 py-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground">
          <span className="text-xs font-medium text-muted">매장</span>
          {stores[0].name}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border px-4 py-2">
      <form ref={formRef} action={selectStore}>
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute left-3 text-xs font-medium text-muted">
            매장
          </span>
          <select
            key={current}
            name="store_id"
            defaultValue={current}
            onChange={() => formRef.current?.requestSubmit()}
            className="w-full appearance-none rounded-xl border border-border bg-card py-2 pl-12 pr-8 text-sm font-semibold text-foreground outline-none ring-brand/30 focus:ring-2"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 text-muted"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </label>
      </form>
    </div>
  );
}
