"use client";

import { useLayoutEffect, useRef } from "react";

// 서버 컴포넌트로 그린 메시지 목록 맨 아래에 두면, 화면이 열릴 때
// 가장 최신 메시지가 바로 보이도록 페이지를 끝까지 내려준다.
export default function ScrollToBottomOnMount() {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    ref.current?.scrollIntoView({ block: "end" });
  }, []);

  return <div ref={ref} aria-hidden />;
}
