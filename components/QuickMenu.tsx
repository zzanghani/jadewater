import Link from "next/link";

const ALL_ITEMS = [
  { href: "/receipts", label: "입고 입력", icon: BoxIcon },
  { href: "/expense", label: "현장지출", icon: ReceiptIcon },
  { href: "/analysis", label: "주간 분석", icon: TrendIcon },
  { href: "/monthly-analysis", label: "월간 분석", icon: CalendarIcon },
  { href: "/cost", label: "실시간 코스트", icon: GaugeIcon },
] as const;

const MASTER_EXCLUDED_HREFS: string[] = ["/receipts", "/expense"];

export default function QuickMenu({ isMaster = false }: { isMaster?: boolean }) {
  const items = isMaster
    ? ALL_ITEMS.filter((i) => !MASTER_EXCLUDED_HREFS.includes(i.href))
    : ALL_ITEMS;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-foreground">빠른 메뉴</h2>
      <div className="grid grid-cols-3 gap-2">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-2 py-3 text-center transition-colors hover:border-brand"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand">
              <Icon />
            </span>
            <span className="text-[11px] font-medium leading-tight text-foreground">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function BoxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14a8 8 0 1 1 16 0" />
      <path d="M12 14 16 9" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}
