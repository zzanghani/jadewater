import Link from "next/link";

export default function MessagesTopTabs({ active }: { active: "dm" | "rooms" }) {
  const tabs = [
    { key: "dm", label: "1:1 메시지", href: "/messages" },
    { key: "rooms", label: "채팅방", href: "/messages/rooms" },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-card p-1.5">
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
