"use client";

import { useActionState, useEffect, useState } from "react";
import { saveClosing } from "@/app/(app)/closing/actions";
import { formatWon } from "@/lib/format";
import { kstDateString } from "@/lib/date";
import type { DailyClosing } from "@/lib/types";

export default function ClosingForm({
  storeId,
  existing,
  defaultDate,
}: {
  storeId: string;
  existing?: DailyClosing;
  defaultDate?: string;
}) {
  const [state, formAction, pending] = useActionState(saveClosing, undefined);

  const [lunchGuests, setLunchGuests] = useState(existing?.lunch_guests ?? 0);
  const [dinnerGuests, setDinnerGuests] = useState(existing?.dinner_guests ?? 0);

  const [cardSales, setCardSales] = useState(existing?.card_sales ?? 0);
  const [cashSales, setCashSales] = useState(existing?.cash_sales ?? 0);
  const [easypaySales, setEasypaySales] = useState(existing?.easypay_sales ?? 0);
  const [discountAmount, setDiscountAmount] = useState(existing?.discount_amount ?? 0);

  const [foodSales, setFoodSales] = useState(existing?.food_sales ?? 0);
  const [beverageSales, setBeverageSales] = useState(existing?.beverage_sales ?? 0);
  const [wineSales, setWineSales] = useState(existing?.wine_sales ?? 0);
  const [rentalSales, setRentalSales] = useState(existing?.rental_sales ?? 0);

  const [coupangEatsSales, setCoupangEatsSales] = useState(
    existing?.coupang_eats_sales ?? 0
  );
  const [baeminSales, setBaeminSales] = useState(existing?.baemin_sales ?? 0);

  const totalGuests = lunchGuests + dinnerGuests;
  const paymentTotal = cardSales + cashSales + easypaySales;
  const categoryTotal = foodSales + beverageSales + wineSales + rentalSales;
  const deliveryTotal = coupangEatsSales + baeminSales;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="store_id" value={storeId} />

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        날짜
        <input
          type="date"
          name="date"
          required
          defaultValue={existing?.date ?? defaultDate ?? kstDateString(0)}
          max={kstDateString(0)}
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 focus:ring-2"
        />
      </label>

      <FieldGroup title="총객수" total={`${totalGuests.toLocaleString()}명`}>
        <NumberField
          label="런치 객수"
          name="lunch_guests"
          suffix="명"
          value={lunchGuests}
          onValueChange={setLunchGuests}
        />
        <NumberField
          label="디너 객수"
          name="dinner_guests"
          suffix="명"
          value={dinnerGuests}
          onValueChange={setDinnerGuests}
        />
      </FieldGroup>

      <FieldGroup title="총매출" total={formatWon(paymentTotal)}>
        <NumberField
          label="카드 매출"
          name="card_sales"
          value={cardSales}
          onValueChange={setCardSales}
        />
        <NumberField
          label="현금 매출"
          name="cash_sales"
          value={cashSales}
          onValueChange={setCashSales}
        />
        <NumberField
          label="간편결제 매출"
          name="easypay_sales"
          value={easypaySales}
          onValueChange={setEasypaySales}
        />
        <NumberField
          label="할인금액"
          name="discount_amount"
          value={discountAmount}
          onValueChange={setDiscountAmount}
        />
      </FieldGroup>

      <FieldGroup title="카테고리" total={formatWon(categoryTotal)}>
        <NumberField
          label="음식 매출"
          name="food_sales"
          value={foodSales}
          onValueChange={setFoodSales}
        />
        <NumberField
          label="음료 매출"
          name="beverage_sales"
          value={beverageSales}
          onValueChange={setBeverageSales}
        />
        <NumberField
          label="와인 매출"
          name="wine_sales"
          value={wineSales}
          onValueChange={setWineSales}
        />
        <NumberField
          label="대관 매출"
          name="rental_sales"
          value={rentalSales}
          onValueChange={setRentalSales}
        />
      </FieldGroup>

      <FieldGroup title="배달매출" total={formatWon(deliveryTotal)}>
        <NumberField
          label="쿠팡이츠 매출"
          name="coupang_eats_sales"
          value={coupangEatsSales}
          onValueChange={setCoupangEatsSales}
        />
        <NumberField
          label="배달의민족 매출"
          name="baemin_sales"
          value={baeminSales}
          onValueChange={setBaeminSales}
        />
      </FieldGroup>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        특이사항
        <textarea
          name="notes"
          rows={3}
          defaultValue={existing?.notes ?? ""}
          placeholder="예) 냉장고 점검, 신메뉴 반응 좋음 등"
          className="resize-none rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          저장되었습니다.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
      >
        {pending ? "저장 중..." : "마감 저장"}
      </button>
    </form>
  );
}

function FieldGroup({
  title,
  total,
  children,
}: {
  title: string;
  total: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-sm font-bold text-brand">{total}</span>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  name,
  value,
  onValueChange,
  suffix = "원",
}: {
  label: string;
  name: string;
  value: number;
  onValueChange: (v: number) => void;
  suffix?: string;
}) {
  const [raw, setRaw] = useState(value ? String(value) : "");

  useEffect(() => {
    setRaw(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          name={name}
          value={raw}
          placeholder="0"
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            setRaw(digits);
            onValueChange(digits ? Number(digits) : 0);
          }}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 pr-10 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">
          {suffix}
        </span>
      </div>
    </label>
  );
}
