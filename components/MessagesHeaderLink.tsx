import Link from "next/link";

export default function MessagesHeaderLink({ hasUnread }: { hasUnread: boolean }) {
  return (
    <Link
      href="/messages"
      aria-label="메시지"
      className="relative flex h-8 w-8 items-center justify-center rounded-full text-foreground"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 4h16v13H8l-4 4Z" />
        <path d="M8 9h8M8 13h5" />
      </svg>
      {hasUnread && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
    </Link>
  );
}
