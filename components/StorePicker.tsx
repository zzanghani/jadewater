"use client";

import { useActionState, useState } from "react";
import { claimStore } from "@/app/actions/auth";
import { storeColor } from "@/lib/storeColors";
import type { Store } from "@/lib/types";

export default function StorePicker({ stores }: { stores: Store[] }) {
  const [state, formAction, pending] = useActionState(claimStore, undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex min-h-dvh w-full flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold">소속 매장을 선택해 주세요</h1>
        <p className="mt-1 text-sm text-muted">처음 한 번만 선택하면 됩니다</p>
      </div>

      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="store_id" value={selectedId ?? ""} />

        {stores.map((s) => {
          const color = storeColor(s.name);
          const isSelected = selectedId === s.id;
          return (
            <div key={s.id} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSelectedId((prev) => (prev === s.id ? null : s.id))}
                style={{ borderLeftColor: color, backgroundColor: `${color}0d` }}
                className={`rounded-xl border border-l-4 border-border py-3 text-sm font-semibold text-foreground transition-opacity hover:opacity-80 ${
                  isSelected ? "ring-2 ring-brand" : ""
                }`}
              >
                {s.name}
              </button>

              {isSelected && (
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/30 disabled:opacity-60"
                >
                  {pending ? "선택 중..." : `${s.name} 선택`}
                </button>
              )}
            </div>
          );
        })}
      </form>

      {state?.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
    </div>
  );
}
