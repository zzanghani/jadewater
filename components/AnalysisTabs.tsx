import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const TABS = [
  { href: "/analysis", label: "주간", title: "주간 분석" },
  { href: "/monthly-analysis", label: "월간", title: "월간 분석" },
  { href: "/weekday-analysis", label: "요일별", title: "요일별 분석" },
  { href: "/cost", label: "코스트", title: "실시간 코스트" },
] as const;

// 주간·월간·요일별 분석과 실시간 코스트를 "매출 분석" 하나로 묶는 상단 탭.
// R&D팀은 요일별·코스트만 볼 수 있고(레이아웃 가드), 직원 계정은 빠른
// 메뉴에서 코스트만 열어줬으므로 그 범위 안의 탭만 보여준다.
export default async function AnalysisTabs() {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { data: profile } = session
    ? await supabase.from("profiles").select("role, department").eq("id", session.user.id).maybeSingle()
    : { data: null };

  const isRnd = profile?.department === "rnd";
  const isStaff = !profile?.department && profile?.role === "staff";
  const tabs = isRnd
    ? TABS.filter((t) => t.href === "/weekday-analysis" || t.href === "/cost")
    : isStaff
      ? TABS.filter((t) => t.href === "/cost")
      : TABS;

  const current = TABS.find((t) => pathname.startsWith(t.href));
  const title = tabs.length > 1 ? "매출 분석" : (current?.title ?? "매출 분석");

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">{title}</h1>
      {tabs.length > 1 && (
        <div className="flex rounded-xl bg-card p-1 ring-1 ring-border">
          {tabs.map((t) => {
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
