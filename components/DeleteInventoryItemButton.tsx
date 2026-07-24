"use client";

import { deleteInventoryItem } from "@/app/(app)/inventory/actions";

export default function DeleteInventoryItemButton({ id }: { id: string }) {
  return (
    <form
      action={deleteInventoryItem}
      onSubmit={(e) => {
        if (!window.confirm("이 품목을 삭제할까요?")) {
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
