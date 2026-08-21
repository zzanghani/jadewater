"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 지점장 계정은 리뷰리포트를 빠른 메뉴로 옮기고 그 자리에 메시지를
// 넣어 달라는 요청으로 매장/마스터 탭 구성이 서로 달라졌다.
const STORE_TABS = [
  { href: "/board", label: "게시판", icon: BoardIcon },
  { href: "/inventory", label: "재고관리", icon: InventoryIcon },
  { href: "/settlement", label: "월말정산", icon: ReportIcon },
  { href: "/payment", label: "입금요청", icon: SendIcon },
  { href: "/messages", label: "메시지", icon: MessageIcon },
] as const;

const MASTER_TABS = [
  { href: "/board", label: "게시판", icon: BoardIcon },
  { href: "/settlement", label: "월말정산", icon: ReportIcon },
  { href: "/review-report", label: "리뷰리포트", icon: StarIcon },
  { href: "/payment", label: "입금요청", icon: SendIcon },
  { href: "/messages", label: "메시지", icon: MessageIcon },
] as const;

// 직원(staff) 계정 — 재고관리, 입고입력, 마감보고(마감입력)까지만.
// 공지사항은 빠른 메뉴로, 입금요청은 뺐다.
const EMPLOYEE_TABS = [
  { href: "/inventory", label: "재고관리", icon: InventoryIcon },
  { href: "/receipts", label: "입고입력", icon: ReceiveIcon },
  { href: "/closing", label: "마감보고", icon: ReportIcon },
] as const;

export default function BottomNav({
  isMaster = false,
  isEmployee = false,
  hasUnreadMessages = false,
}: {
  isMaster?: boolean;
  isEmployee?: boolean;
  hasUnreadMessages?: boolean;
}) {
  const pathname = usePathname();
  const tabs = isEmployee ? EMPLOYEE_TABS : isMaster ? MASTER_TABS : STORE_TABS;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex h-20 max-w-md items-center justify-around px-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const path = href.split("?")[0];
          const active =
            pathname.startsWith(path) || (path === "/board" && pathname.startsWith("/weekly-report"));
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                active ? "text-brand" : "text-muted"
              }`}
            >
              <span className="relative">
                <Icon active={active} />
                {href === "/messages" && hasUnreadMessages && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
                )}
              </span>
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

function MessageIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-4.7 7.6 8.5 8.5 0 0 1-8.9-.8L3 20l1.7-4.4A8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  );
}

function ReceiveIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v10" />
      <path d="m7 9 5 5 5-5" />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}
