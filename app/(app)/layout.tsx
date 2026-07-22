import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import StoreSwitcher from "@/components/StoreSwitcher";
import PullToRefresh from "@/components/PullToRefresh";

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
    supabase.from("profiles").select("name").eq("id", user.id).single(),
    getStoreContext(supabase),
  ]);
  const { storeId, stores } = storeContext;
  const isMaster = stores.length > 1;

  const name = isMaster
    ? "제이드앤워터대표"
    : profile?.name ?? user.email?.split("@")[0] ?? "사용자";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="JADE & WATER"
              width={1000}
              height={244}
              className="h-7 w-auto"
            />
          </Link>
          <div className="flex items-center gap-2">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{name}님</p>
            </div>
            <LogoutButton />
          </div>
        </div>
        <StoreSwitcher stores={stores} current={storeId} />
      </header>

      <main className="flex-1 px-4 pb-6 pt-4">
        <PullToRefresh>{children}</PullToRefresh>
      </main>

      <BottomNav isMaster={isMaster} />
    </>
  );
}
