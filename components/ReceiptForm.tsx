"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveReceipt } from "@/app/(app)/receipts/actions";
import { kstDateString } from "@/lib/date";
import type { Receipt, ReceiptCategory } from "@/lib/types";

const CATEGORIES: ReceiptCategory[] = ["식재료", "음료재료", "소모품", "기타"];

export default function ReceiptForm({
  storeId,
  existing,
}: {
  storeId: string;
  existing?: Receipt;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveReceipt, undefined);
  const [category, setCategory] = useState<ReceiptCategory>(
    existing?.category ?? "식재료"
  );
  const [amountRaw, setAmountRaw] = useState(
    existing?.amount ? String(existing.amount) : ""
  );
  const [resetKey, setResetKey] = useState(0);
  const isEditing = Boolean(existing);

  // 신규 등록 성공 시 다음 항목을 바로 입력할 수 있도록 폼을 비우고,
  // 수정 성공 시에는 목록 화면으로 돌아간다.
  useEffect(() => {
    if (!state?.success) return;
    if (isEditing) {
      router.push("/receipts");
      return;
    }
    setAmountRaw("");
    setCategory("식재료");
    setResetKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form key={resetKey} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="store_id" value={storeId} />
      {existing && <input type="hidden" name="id" value={existing.id} />}

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        날짜
        <input
          type="date"
          name="date"
          required
          defaultValue={existing?.date ?? kstDateString(0)}
          max={kstDateString(0)}
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        거래처명
        <input
          type="text"
          name="supplier"
          required
          defaultValue={existing?.supplier ?? ""}
          placeholder="예) 다올식자재"
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        품목 메모
        <textarea
          name="items"
          rows={2}
          defaultValue={existing?.items ?? ""}
          placeholder="예) 양파 2박스, 대파 1단"
          className="resize-none rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        금액
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            name="amount"
            required
            value={amountRaw}
            placeholder="0"
            onChange={(e) =>
              setAmountRaw(e.target.value.replace(/[^0-9]/g, ""))
            }
            className="w-full rounded-xl border border-border bg-card px-4 py-3 pr-10 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">
            원
          </span>
        </div>
      </label>

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        카테고리
        <div className="grid grid-cols-4 gap-2">
          <input type="hidden" name="category" value={category} />
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-xl border py-2.5 text-xs font-semibold transition-colors ${
                category === c
                  ? "border-brand bg-brand-light text-brand"
                  : "border-border bg-card text-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state?.success && !isEditing && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          저장되었습니다.
        </p>
      )}

      <div className="flex gap-2">
        {isEditing && (
          <button
            type="button"
            onClick={() => router.push("/receipts")}
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
          {pending ? "저장 중..." : isEditing ? "수정 저장" : "입고 저장"}
        </button>
      </div>
    </form>
  );
}
