"use client";

import { deleteShift } from "@/app/(app)/schedule/actions";

export default function DeleteShiftButton({ id, date }: { id: string; date: string }) {
  return (
    <form
      action={deleteShift}
      onSubmit={(e) => {
        if (!window.confirm("이 근무 일정을 삭제할까요?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="date" value={date} />
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
