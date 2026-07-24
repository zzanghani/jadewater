"use client";

import { adjustQuantity } from "@/app/(app)/inventory/actions";

export default function InventoryQuantityStepper({
  id,
  quantity,
  unit,
}: {
  id: string;
  quantity: number;
  unit: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <form action={adjustQuantity}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="delta" value="-1" />
        <button
          type="submit"
          aria-label="수량 감소"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-brand hover:text-brand"
        >
          −
        </button>
      </form>
      <span className="min-w-[3.5rem] text-center text-sm font-bold text-foreground">
        {quantity}
        {unit ? ` ${unit}` : ""}
      </span>
      <form action={adjustQuantity}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="delta" value="1" />
        <button
          type="submit"
          aria-label="수량 증가"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-brand hover:text-brand"
        >
          +
        </button>
      </form>
    </div>
  );
}
