import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const TABS = [
  { href: "/analysis", label: "주간" },
  { href: "/monthly-analysis", label: "월간" },
  { href: "/weekday-analysis", label: "요일별" },
] as const;

// 주간·월간·요일별 분석 세 화면을 "매출 분석" 하나로 묶는 상단 탭.
// R&D팀은 요일별만 볼 수 있어서(레이아웃 가드) 탭을 아예 안 보여준다.
export default async function AnalysisTabs() {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { data: profile } = session
    ? await supabase.from("profiles").select("department").eq("id", session.user.id).maybeSingle()
    : { data: null };
  const showTabs = profile?.department !== "rnd";

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">매출 분석</h1>
      {showTabs && (
        <div className="flex rounded-xl bg-card p-1 ring-1 ring-border">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
                  active ? "bg-brand text-white shadow-sm" : "text-muted"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
