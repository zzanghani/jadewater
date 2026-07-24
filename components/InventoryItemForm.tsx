"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveInventoryItem } from "@/app/(app)/inventory/actions";
import type { InventoryItem, InventorySection } from "@/lib/types";

export default function InventoryItemForm({
  storeId,
  section,
  date,
  existing,
}: {
  storeId: string;
  section: InventorySection;
  date: string;
  existing?: InventoryItem;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveInventoryItem, undefined);
  const [resetKey, setResetKey] = useState(0);
  const isEditing = Boolean(existing);
  const backHref = `/inventory?section=${encodeURIComponent(section)}&date=${date}`;

  // 새 품목 등록 성공 시 다음 품목을 바로 입력할 수 있도록 폼을 비우고,
  // 수정 성공 시에는 목록으로 돌아간다.
  useEffect(() => {
    if (!state?.success) return;
    if (isEditing) {
      router.push(backHref);
      return;
    }
    setResetKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form key={resetKey} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="store_id" value={storeId} />
      <input type="hidden" name="section" value={section} />
      {existing && <input type="hidden" name="id" value={existing.id} />}

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
          품목명
          <input
            type="text"
            name="name"
            required
            defaultValue={existing?.name ?? ""}
            placeholder="예) 삼겹살"
            className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
        </label>
        <label className="flex w-24 flex-col gap-1.5 text-sm font-medium">
          단위
          <input
            type="text"
            name="unit"
            defaultValue={existing?.unit ?? ""}
            placeholder="개"
            className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        메모 <span className="font-normal text-muted">(선택)</span>
        <input
          type="text"
          name="notes"
          defaultValue={existing?.notes ?? ""}
          placeholder="예) 냉동실 하단"
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-2">
        {isEditing && (
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted transition-colors hover:text-foreground"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
        >
          {pending ? "저장 중..." : isEditing ? "수정 저장" : "품목 추가"}
        </button>
      </div>
    </form>
  );
}
