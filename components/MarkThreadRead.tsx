"use client";

import { useEffect, useRef } from "react";
import { markThreadRead } from "@/app/(app)/messages/actions";

// 대화창 페이지 렌더링 중에 markThreadRead(서버 액션, 내부에서
// revalidatePath 호출)를 직접 부르면 Next.js가 "렌더링 중 revalidatePath
// 호출"로 막아 페이지 자체가 로드되지 않는다. 마운트 후 클라이언트에서
// 호출하는 방식으로 바꿔서, 화면은 정상적으로 뜬 다음 읽음 처리만
// 비동기로 따라오게 한다.
export default function MarkThreadRead({ otherUserId }: { otherUserId: string }) {
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (done.current === otherUserId) return;
    done.current = otherUserId;
    markThreadRead(otherUserId);
  }, [otherUserId]);

  return null;
}
