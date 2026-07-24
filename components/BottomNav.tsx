"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ALL_TABS = [
  { href: "/board", label: "게시판", icon: BoardIcon },
  { href: "/inventory", label: "재고관리", icon: InventoryIcon },
  { href: "/settlement", label: "월말정산", icon: ReportIcon },
  { href: "/review-report", label: "리뷰리포트", icon: StarIcon },
  { href: "/payment", label: "입금요청", icon: SendIcon },
] as const;

export default function BottomNav({ isMaster = false }: { isMaster?: boolean }) {
  const pathname = usePathname();
  const tabs = isMaster ? ALL_TABS.filter((t) => t.href !== "/inventory") : ALL_TABS;

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active =
            pathname.startsWith(href) || (href === "/board" && pathname.startsWith("/weekly-report"));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                active ? "text-brand" : "text-muted"
              }`}
            >
              <Icon active={active} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function BoardIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v13H8l-4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}

function InventoryIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  );
}

function ReportIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h8l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M9 12h6M9 16h6M9 8h3" />
    </svg>
  );
}

function StarIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 2.6 5.7 6.2.6-4.7 4.2 1.4 6.1L12 16.9 6.5 19.6l1.4-6.1-4.7-4.2 6.2-.6Z" />
    </svg>
  );
}

function SendIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4Z" />
    </svg>
  );
}
