"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBoardPostAction } from "@/app/(app)/board/actions";

export default function BoardDeleteButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (pending) return;
    if (!window.confirm("이 글을 삭제할까요? 되돌릴 수 없습니다.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteBoardPostAction(postId);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        router.push("/board");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs font-semibold text-red-600 disabled:opacity-60"
      >
        {pending ? "삭제 중..." : "삭제"}
      </button>
      {error && <p className="max-w-[140px] text-right text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
