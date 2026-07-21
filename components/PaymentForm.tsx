"use client";

import { useActionState, useState } from "react";
import { savePaymentRequest } from "@/app/(app)/payment/actions";
import type { Store } from "@/lib/types";

export default function PaymentForm({
  storeId,
  stores,
}: {
  storeId: string;
  stores: Store[];
}) {
  const [state, formAction, pending] = useActionState(
    savePaymentRequest,
    undefined
  );
  const [vendorName, setVendorName] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        지점
        {stores.length > 1 ? (
          <select
            name="store_id"
            defaultValue={storeId}
            className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 focus:ring-2"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input type="hidden" name="store_id" value={storeId} />
            <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground">
              {stores[0]?.name ?? "-"}
            </div>
          </>
        )}
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        거래처명
        <input
          type="text"
          name="vendor_name"
          required
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          placeholder="예) 다올식자재"
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

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        은행명 (선택)
        <input
          type="text"
          name="bank_name"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          placeholder="예) 국민은행"
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        계좌번호 (선택)
        <input
          type="text"
          name="account_number"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="예) 123456-78-901234"
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          입금요청이 저장되었습니다.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
      >
        {pending ? "저장 중..." : "입금요청"}
      </button>
    </form>
  );
}
