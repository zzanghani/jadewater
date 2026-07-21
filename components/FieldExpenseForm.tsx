"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveFieldExpense } from "@/app/(app)/payment/actions";
import { kstDateString } from "@/lib/date";
import type { FieldExpenseCategory, FieldExpensePaymentMethod } from "@/lib/types";

const CATEGORIES: FieldExpenseCategory[] = [
  "식자재",
  "소모품",
  "유류비",
  "복리후생",
  "운영",
  "마케팅",
  "기타",
];

const PAYMENT_METHODS: FieldExpensePaymentMethod[] = ["법인카드", "현금", "자동이체"];

export default function FieldExpenseForm({ storeId }: { storeId: string }) {
  const [state, formAction, pending] = useActionState(
    saveFieldExpense,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(kstDateString(0));
  const [category, setCategory] = useState<FieldExpenseCategory>("식자재");
  const [description, setDescription] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<FieldExpensePaymentMethod>("법인카드");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!state?.success) return;
    formRef.current?.reset();
    setDate(kstDateString(0));
    setCategory("식자재");
    setDescription("");
    setAmountRaw("");
    setPaymentMethod("법인카드");
    setPhotoPreview(null);
  }, [state?.success]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPhotoPreview(null);
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="store_id" value={storeId} />

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        영수증 사진
        <input
          ref={fileInputRef}
          type="file"
          name="receipt_photo"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />
        {photoPreview ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="영수증 미리보기"
              className="h-40 w-40 rounded-xl border border-border object-cover"
            />
            <button
              type="button"
              onClick={clearPhoto}
              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background shadow"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-6 text-sm font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
          >
            📷 영수증 촬영하기
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        일자
        <input
          type="date"
          name="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        대분류
        <select
          name="category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value as FieldExpenseCategory)}
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 focus:ring-2"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        구매내역
        <input
          type="text"
          name="description"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예) 주방세제 외 2건"
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
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
        결제수단
        <input type="hidden" name="payment_method" value={paymentMethod} />
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPaymentMethod(m)}
              className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                paymentMethod === m
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border bg-card text-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          지출이 저장되었습니다.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
      >
        {pending ? "저장 중..." : "지출저장"}
      </button>
    </form>
  );
}
