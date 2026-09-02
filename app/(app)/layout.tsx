import Image from "next/image";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { LAYOUT_MODE_COOKIE, isDesktopMode } from "@/lib/layoutMode";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import StoreSwitcher from "@/components/StoreSwitcher";
import LayoutModeToggle from "@/components/LayoutModeToggle";
import PullToRefresh from "@/components/PullToRefresh";
import StorePicker from "@/components/StorePicker";
import Avatar from "@/components/Avatar";
import { fetchAvatarUrlById } from "@/lib/avatar";

// 매장 운영/재무 화면에는 접근을 주지 않는 본사 팀 계정(디자인/마케팅/운영/R&D)이
// 다른 경로로 직접 들어와도 여기서 걸러진다. 실제 데이터 차단은 RLS
// (user_can_access_store_ops)가 하고, 이건 어색한 빈 화면 대신 깔끔하게
// 홈으로 돌려보내는 UX용 가드다.
const TEAM_ALLOWED_PREFIXES = ["/", "/board", "/weekly-report", "/expense", "/review-report", "/payment", "/profile", "/messages"];

// 직원(staff) 계정도 월말정산·채팅(추후 지점별 채팅 예정)만 빼면
// 지점 계정과 같은 화면을 그대로 쓴다 — 나머지는 URL을 직접 입력해도
// 홈으로 돌려보낸다. 실제 데이터 차단은 RLS(user_is_store_manager 등)가
// 하고, 이건 어색한 빈 화면 대신 깔끔하게 홈으로 돌려보내는 UX용 가드다.
const EMPLOYEE_ALLOWED_PREFIXES = [
  "/",
  "/board",
  "/inventory",
  "/payment",
  "/schedule",
  "/profile",
  "/closing",
  "/receipts",
  "/expense",
  "/analysis",
  "/monthly-analysis",
  "/weekday-analysis",
  "/cost",
  "/review-report",
  "/messages",
  // 자기평가 — 직원 본인이 자기 평가표를 쓰고 확정 결과를 보는 화면.
  "/my-review",
];

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, department, role, status, store_id")
    .eq("id", user.id)
    .single();

  // 가입 승인 대기/거절된 계정은 앱 화면 자체를 보여주지 않는다.
  if (profile?.status === "pending") {
    return <PendingScreen />;
  }
  if (profile?.status === "rejected") {
    return <RejectedScreen />;
  }

  // 승인된 직원(role='staff') 계정이 아직 소속 매장을 고르지 않았으면
  // (store_id가 비어 있으면) 그 전에는 이 값만으로 "마스터"와 구분이 안
  // 되므로(둘 다 store_id가 null), 여기서 먼저 매장 선택 화면으로
  // 보내고 이후 로직에 들어가지 않게 한다.
  if (profile?.role === "staff" && !profile.department && !profile.store_id) {
    const { data: allStores } = await supabase.from("stores").select("*").order("sort_order");
    return <StorePicker stores={allStores ?? []} />;
  }

  const [storeContext, myAvatarById, { count: unreadMessageCount }] = await Promise.all([
    getStoreContext(supabase),
    fetchAvatarUrlById(supabase, [user.id]),
    supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);
  const { storeId, brand, stores, brands } = storeContext;
  const isTeamAccount = !!profile?.department;
  const isMaster = stores.length > 1 && !isTeamAccount;
  // 직원(staff) role로 매장이 배정된 계정 — 지점장(owner)보다 제한된
  // 화면만 이용한다. 지점장/마스터 계정은 role이 'owner'다.
  const isEmployee = !isTeamAccount && !isMaster && profile?.role === "staff";
  // 베스트메이트컴퍼니(본사) 계정 — 마스터 + 팀 계정. 매장 지점장/직원은
  // 자기 매장이 속한 브랜드(제이드앤워터 / 정다미)의 로고와 톤을 본다.
  // 톤 클래스와 로고 경로는 brands 테이블에서 오고, 실제 색상 값은
  // globals.css의 .theme-jadewater / .theme-jeongdami / .theme-bestmate 참고.
  const isBestmateHq = isTeamAccount || isMaster;
  const themeClass = isBestmateHq ? "theme-bestmate" : brand?.theme_class ?? "theme-jadewater";

  if (isTeamAccount) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const isHrTeam = profile?.department === "rnd" || profile?.department === "ops";
    const isRnd = profile?.department === "rnd";
    // R&D팀은 재고관리 입력에 더해, 스케줄러·실시간 코스트·요일별 분석을
    // "보기 전용"으로 본다(실제 조회 제한은 RLS의 user_can_view_store_ops).
    const isRndViewOnly =
      isRnd &&
      (pathname.startsWith("/schedule") ||
        pathname.startsWith("/cost") ||
        pathname.startsWith("/weekday-analysis"));
    const allowed =
      TEAM_ALLOWED_PREFIXES.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p))) ||
      (isHrTeam && pathname.startsWith("/hr")) ||
      (isRnd && pathname.startsWith("/inventory")) ||
      isRndViewOnly;
    if (!allowed) {
      redirect("/");
    }
  }

  if (isEmployee) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const allowed = EMPLOYEE_ALLOWED_PREFIXES.some((p) =>
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

  const desktopMode = isDesktopMode((await cookies()).get(LAYOUT_MODE_COOKIE)?.value);

  return (
    <div
      className={`flex w-full flex-1 flex-col bg-background ${themeClass}`}
    >
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="cursor-pointer">
            {isBestmateHq ? (
              <Image
                src="/bestmate-logo.png"
                alt="BESTMATE COMPANY"
                width={1585}
                height={472}
                className="h-7 w-auto"
              />
            ) : brand?.logo_path ? (
              <Image
                src={brand.logo_path}
                alt={brand.name}
                width={1000}
                height={244}
                className="h-7 w-auto"
              />
            ) : (
              /* 로고 이미지가 아직 없는 브랜드는 이름을 글자로 보여준다.
                 public/에 PNG를 넣고 brands.logo_path만 채우면 이미지로 바뀐다. */
              <span className="text-lg font-bold tracking-tight text-brand-dark">
                {brand?.name ?? "매장"}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/profile" className="flex items-center gap-1.5">
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold">{name}님</p>
              </div>
              <Avatar name={name} avatarUrl={myAvatarById.get(user.id)} size={28} />
            </Link>
            <LayoutModeToggle desktopMode={desktopMode} />
            <LogoutButton />
          </div>
        </div>
        <StoreSwitcher stores={stores} brands={brands} current={storeId} />
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

      {!isTeamAccount && (
        <BottomNav
          isMaster={isMaster}
          isEmployee={isEmployee}
          hasUnreadMessages={(unreadMessageCount ?? 0) > 0}
        />
      )}
    </div>
  );
}

function PendingScreen() {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <h1 className="text-xl font-bold">가입 승인 대기 중이에요</h1>
      <p className="text-sm text-muted">
        관리자가 가입을 승인하면 바로 이용할 수 있어요. 잠시만 기다려 주세요.
      </p>
      <form action={logout}>
        <button
          type="submit"
          className="mt-2 rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-semibold text-muted"
        >
          로그인 화면으로
        </button>
      </form>
    </div>
  );
}

function RejectedScreen() {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <h1 className="text-xl font-bold">가입이 승인되지 않았어요</h1>
      <p className="text-sm text-muted">문의사항이 있으면 관리자에게 연락해 주세요.</p>
      <form action={logout}>
        <button
          type="submit"
          className="mt-2 rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-semibold text-muted"
        >
          로그인 화면으로
        </button>
      </form>
    </div>
  );
}
