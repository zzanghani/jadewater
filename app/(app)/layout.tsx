import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import StoreSwitcher from "@/components/StoreSwitcher";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();

  const { storeId, stores } = await getStoreContext(supabase);
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

      <main className="flex-1 px-4 pb-6 pt-4">{children}</main>

      <BottomNav isMaster={isMaster} />
    </>
  );
}
