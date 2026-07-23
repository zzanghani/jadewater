import Link from "next/link";
import { NOTICE, WORK_CATEGORIES } from "@/lib/board";

export default function BoardTopTabs({
  active,
  statusSuffix = "",
}: {
  active: "notice" | "work" | "weekly";
  statusSuffix?: string;
}) {
  const tabs = [
    {
      key: "notice",
      label: "공지사항",
      href: `/board?category=${encodeURIComponent(NOTICE)}${statusSuffix}`,
    },
    {
      key: "work",
      label: "업무게시판",
      href: `/board?category=${encodeURIComponent(WORK_CATEGORIES[0])}${statusSuffix}`,
    },
    { key: "weekly", label: "주간보고", href: "/weekly-report" },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl bg-card p-1.5">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-xl py-2.5 text-center text-sm font-semibold transition-colors ${
            active === t.key ? "bg-brand text-white shadow-sm" : "text-muted"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
