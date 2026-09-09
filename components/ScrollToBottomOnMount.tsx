"use client";

import { useEffect, useRef } from "react";

// 서버 컴포넌트로 그린 메시지 목록 맨 아래에 두면, 화면이 열릴 때
// 가장 최신 메시지가 바로 보이도록 페이지를 끝까지 내려준다.
//
// Next.js 라우터는 페이지 이동이 끝난 뒤 스크롤을 맨 위로 올리는데, 그게
// 자식의 레이아웃 이펙트보다 늦게 실행돼서 바로 내리면 다시 위로 튕긴다.
// 그래서 두 프레임 뒤로 미뤄서 라우터 스크롤 다음에 내린다.
export default function ScrollToBottomOnMount() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        ref.current?.scrollIntoView({ block: "end" });
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  return <div ref={ref} aria-hidden />;
}
