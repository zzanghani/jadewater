"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PULL_THRESHOLD = 70;
const MAX_PULL = 110;
const DAMPING = 0.5;

export default function PullToRefresh({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    let startY = 0;
    let pulling = false;

    function onTouchStart(e: TouchEvent) {
      if (refreshingRef.current) {
        pulling = false;
        return;
      }
      // 페이지 최상단에서 아래로 당기기 시작할 때만 제스처를 활성화한다.
      if (window.scrollY <= 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      } else {
        pulling = false;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling) return;
      const delta = e.touches[0].clientY - startY;
      if (delta > 0 && window.scrollY <= 0) {
        // 브라우저 자체의 바운스 스크롤과 겹치지 않도록 막고, 우리 인디케이터만 보여준다.
        e.preventDefault();
        setPullDistance(Math.min(delta * DAMPING, MAX_PULL));
      } else {
        pulling = false;
        setPullDistance(0);
      }
    }

    function onTouchEnd() {
      if (!pulling) return;
      pulling = false;
      setPullDistance((current) => {
        if (current >= PULL_THRESHOLD * 0.85) {
          refreshingRef.current = true;
          setRefreshing(true);
          router.refresh();
          setTimeout(() => {
            refreshingRef.current = false;
            setRefreshing(false);
            setPullDistance(0);
          }, 700);
          return PULL_THRESHOLD * 0.6;
        }
        return 0;
      });
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [router]);

  return (
    <div>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: pullDistance,
          transition: pullDistance === 0 ? "height 0.25s ease" : undefined,
        }}
      >
        {pullDistance > 0 && (
          <span
            className={`text-lg text-muted ${refreshing ? "animate-spin" : ""}`}
            style={
              refreshing
                ? undefined
                : {
                    transform: `rotate(${Math.min(
                      (pullDistance / PULL_THRESHOLD) * 200,
                      200
                    )}deg)`,
                  }
            }
          >
            🔄
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
