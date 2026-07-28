import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import StoreSwitcher from "@/components/StoreSwitcher";
import PullToRefresh from "@/components/PullToRefresh";

// 매장 운영/재무 화면에는 접근을 주지 않는 본사 팀 계정(디자인/마케팅/운영/R&D)이
// 다른 경로로 직접 들어와도 여기서 걸러진다. 실제 데이터 차단은 RLS
// (user_can_access_store_ops)가 하고, 이건 어색한 빈 화면 대신 깔끔하게
// 홈으로 돌려보내는 UX용 가드다.
const TEAM_ALLOWED_PREFIXES = ["/", "/board", "/weekly-report", "/expense"];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  // proxy.ts가 이미 로그인 여부로 리다이렉트를 처리했으므로, 여기서는
  // Auth 서버에 재검증 요청을 보내는 getUser() 대신 로컬 세션만 읽는다.
  // (혹시 이 레이아웃에 프록시를 안 거치고 도달하는 경로가 생기더라도
  // 아래 리다이렉트가 그대로 방어막 역할을 한다.)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, storeContext] = await Promise.all([
    supabase.from("profiles").select("name, department").eq("id", user.id).single(),
    getStoreContext(supabase),
  ]);
  const { storeId, stores } = storeContext;
  const isTeamAccount = !!profile?.department;
  const isMaster = stores.length > 1 && !isTeamAccount;
  // 베스트메이트컴퍼니(본사) 계정 — 마스터 + 팀 계정. 매장 지점장/직원은 그대로
  // 제이드앤워터 톤을 본다. [프로토타입] 실제 반영 전 색/로고 미리보기용.
  const isBestmateHq = isTeamAccount || isMaster;
  const hqBrandStyle: CSSProperties | undefined = isBestmateHq
    ? ({
        "--brand": "#061383",
        "--brand-dark": "#04104f",
        "--brand-light": "#e7e9f6",
      } as CSSProperties)
    : undefined;

  if (isTeamAccount) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const allowed = TEAM_ALLOWED_PREFIXES.some((p) =>
      p === "/" ? pathname === "/" : pathname.startsWith(p)
    );
    if (!allowed) {
      redirect("/");
    }
  }

  const name = isTeamAccount
    ? profile?.name ?? "팀 계정"
    : isMaster
      ? "제이드앤워터대표"
      : profile?.name ?? user.email?.split("@")[0] ?? "사용자";

  return (
    <div className="flex w-full flex-1 flex-col" style={hqBrandStyle}>
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/">
            {isBestmateHq ? (
              <Image
                src="/bestmate-logo.png"
                alt="BESTMATE COMPANY"
                width={1585}
                height={472}
                className="h-7 w-auto"
              />
            ) : (
              <Image
                src="/logo.png"
                alt="JADE & WATER"
                width={1000}
                height={244}
                className="h-7 w-auto"
              />
            )}
          </Link>
          <div className="flex items-center gap-2">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{name}님</p>
            </div>
            <LogoutButton />
          </div>
        </div>
        {!isTeamAccount && <StoreSwitcher stores={stores} current={storeId} />}
      </header>

      {/* 하단 내비는 iOS Safari의 sticky bottom 버그를 피하려고 fixed로
          띄워서 문서 흐름 밖에 있으므로, 본문 아래쪽에 그 높이만큼
          여백을 직접 확보해줘야 마지막 콘텐츠가 가려지지 않는다.
          팀 계정은 하단바 없이 홈 화면 빠른메뉴로만 이동한다. */}
      <main
        className={`flex-1 px-4 pt-4 ${
          isTeamAccount ? "pb-[calc(1rem+env(safe-area-inset-bottom))]" : "pb-[calc(5rem+env(safe-area-inset-bottom))]"
        }`}
      >
        <PullToRefresh>{children}</PullToRefresh>
      </main>

      {!isTeamAccount && <BottomNav isMaster={isMaster} />}
    </div>
  );
}
