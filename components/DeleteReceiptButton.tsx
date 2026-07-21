"use client";

import { deleteReceipt } from "@/app/(app)/receipts/actions";

export default function DeleteReceiptButton({ id }: { id: string }) {
  return (
    <form
      action={deleteReceipt}
      onSubmit={(e) => {
        if (!window.confirm("이 입고 내역을 삭제할까요?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label="삭제"
        className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-red-500"
      >
        삭제
      </button>
    </form>
  );
}
