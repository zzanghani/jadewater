import Link from "next/link";

const ALL_ITEMS = [
  { href: "/closing", label: "마감입력", icon: PencilIcon },
  { href: "/schedule", label: "스케줄러", icon: ScheduleIcon },
  { href: "/receipts", label: "입고 입력", icon: BoxIcon },
  { href: "/expense", label: "현장지출", icon: ReceiptIcon },
  { href: "/analysis", label: "주간 분석", icon: TrendIcon },
  { href: "/monthly-analysis", label: "월간 분석", icon: CalendarIcon },
  { href: "/weekday-analysis", label: "요일별 분석", icon: WeekdayIcon },
  { href: "/cost", label: "실시간 코스트", icon: GaugeIcon },
] as const;

// 마스터는 마감입력·입고입력·현장지출처럼 매일 직접 입력하는 화면은 굳이
// 빠른메뉴에 안 두지만, 스케줄러는 전 매장을 훑어보는 용도라 남겨둔다.
const MASTER_EXCLUDED_HREFS: string[] = ["/closing", "/receipts", "/expense"];

// 게시판·메시지는 하단 탭으로 옮겨서 여기엔 안 둔다.
const TEAM_ITEMS = [
  { href: "/expense", label: "현장지출", icon: ReceiptIcon },
  { href: "/payment", label: "입금요청", icon: PaymentIcon },
  { href: "/review-report", label: "리뷰리포트", icon: StarIcon },
] as const;

const HR_ITEM = { href: "/hr", label: "HR", icon: HrIcon } as const;
const ACCOUNTS_ITEM = { href: "/accounts", label: "가입승인", icon: HrIcon } as const;
const INVENTORY_ITEM = { href: "/inventory", label: "재고관리", icon: BoxIcon } as const;
// R&D팀 전용 보기 전용 항목(스케줄러·실시간 코스트·요일별 분석) — 입력 권한은
// 없고 전 매장을 매장 선택 드롭다운으로 바꿔가며 조회만 한다.
const RND_VIEW_ITEMS = [
  { href: "/schedule", label: "스케줄러", icon: ScheduleIcon },
  { href: "/cost", label: "실시간 코스트", icon: GaugeIcon },
  { href: "/weekday-analysis", label: "요일별 분석", icon: WeekdayIcon },
] as const;
// 지점장(매장) 계정은 리뷰리포트가 하단 메뉴 대신 여기로 옮겨왔다.
const REVIEW_REPORT_ITEM = { href: "/review-report", label: "리뷰리포트", icon: StarIcon } as const;

// 직원(staff) 계정 — 입고입력·마감입력(마감보고)·메시지는 하단 메뉴로
// 옮기고, 스케줄러는 홈 화면 미리보기로 대체, 리뷰리포트·주간/월간
// 분석은 뺐다.
const EMPLOYEE_ITEMS = [
  { href: "/board?category=공지사항", label: "공지사항", icon: BoardIcon },
  { href: "/expense", label: "현장지출", icon: ReceiptIcon },
  { href: "/cost", label: "실시간 코스트", icon: GaugeIcon },
  { href: "/my-review", label: "내 평가", icon: ReviewIcon },
] as const;

// 지점장·부점장·팀장도 평가 대상이라 자기평가를 쓴다.
const MY_REVIEW_ITEM = { href: "/my-review", label: "내 평가", icon: ReviewIcon } as const;

export default function QuickMenu({
  isMaster = false,
  teamOnly = false,
  employeeOnly = false,
  showHr = false,
  showInventory = false,
  showStoreOpsView = false,
  pendingAccountCount = 0,
}: {
  isMaster?: boolean;
  teamOnly?: boolean;
  employeeOnly?: boolean;
  showHr?: boolean;
  showInventory?: boolean;
  showStoreOpsView?: boolean;
  pendingAccountCount?: number;
}) {
  // 게시판·메시지는 이제 본사 팀 계정도 하단 탭으로 오가서 여기엔 안 넣는다.
  const items = teamOnly
    ? [
        ...TEAM_ITEMS,
        ...(showHr ? [HR_ITEM] : []),
        ...(showInventory ? [INVENTORY_ITEM] : []),
        ...(showStoreOpsView ? RND_VIEW_ITEMS : []),
      ]
    : employeeOnly
      ? EMPLOYEE_ITEMS
      : isMaster
        ? [...ALL_ITEMS.filter((i) => !MASTER_EXCLUDED_HREFS.includes(i.href)), HR_ITEM, ACCOUNTS_ITEM]
        : [...ALL_ITEMS, REVIEW_REPORT_ITEM, HR_ITEM, MY_REVIEW_ITEM];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-foreground">빠른 메뉴</h2>
      <div className="grid grid-cols-3 gap-2">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="relative flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-2 py-3 text-center transition-colors hover:border-brand"
          >
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand">
              <Icon />
              {href === "/accounts" && pendingAccountCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
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

function BoardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v13H8l-4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
    </svg>
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

function WeekdayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="M8 14v3M12 12v5M16 15v2" />
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

// 내 평가 — 체크리스트 모양. HR 아이콘(사람)과 헷갈리지 않게 구분한다.
function ReviewIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8a2 2 0 0 1 2 2v13a1 1 0 0 1-1.5.87L12 17.5l-4.5 2.37A1 1 0 0 1 6 19V6a2 2 0 0 1 2-2Z" />
      <path d="m9.5 9.5 1.5 1.5 3.5-3.5" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 2.6 5.7 6.2.6-4.7 4.2 1.4 6.1L12 16.9 6.5 19.6l1.4-6.1-4.7-4.2 6.2-.6Z" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}

function HrIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M17 8h4M19 6v4" />
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
