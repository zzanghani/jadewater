"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { shiftDateString } from "@/lib/date";
import type { InventorySection } from "@/lib/types";

export default function InventoryDatePicker({
  section,
  date,
}: {
  section: InventorySection;
  date: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/inventory?section=${encodeURIComponent(section)}&date=${shiftDateString(date, -1)}`}
        aria-label="전날"
        className="rounded-lg px-1.5 py-1 text-muted transition-colors hover:text-foreground"
      >
        ‹
      </Link>
      <input
        type="date"
        defaultValue={date}
        onChange={(e) => {
          if (!e.target.value) return;
          router.push(`/inventory?section=${encodeURIComponent(section)}&date=${e.target.value}`);
        }}
        className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground outline-none ring-brand/30 focus:ring-2"
      />
      <Link
        href={`/inventory?section=${encodeURIComponent(section)}&date=${shiftDateString(date, 1)}`}
        aria-label="다음날"
        className="rounded-lg px-1.5 py-1 text-muted transition-colors hover:text-foreground"
      >
        ›
      </Link>
    </div>
  );
}
