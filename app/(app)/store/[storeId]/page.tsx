import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { daysInMonthKST, kstDateString } from "@/lib/date";
import { getStoreContext } from "@/lib/store";
import { storeColor } from "@/lib/storeColors";
import ClosingCalendar from "@/components/ClosingCalendar";
import type { DailyClosing } from "@/lib/types";

function monthInfo(monthParam?: string) {
  const base =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : kstDateString(0).slice(0, 7);
  const [y, m] = base.split("-").map(Number);
  const start = `${base}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${base}-${String(lastDay).padStart(2, "0")}`;
  const label = `${y}년 ${m}월`;

  const prevTotal = y * 12 + (m - 1) - 1;
  const nextTotal = y * 12 + (m - 1) + 1;
  const prev = `${Math.floor(prevTotal / 12)}-${String((prevTotal % 12) + 1).padStart(2, "0")}`;
  const next = `${Math.floor(nextTotal / 12)}-${String((nextTotal % 12) + 1).padStart(2, "0")}`;

  return { start, end, label, prev, next };
}

export default async function StoreHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { storeId } = await params;
  const { month: monthParam } = await searchParams;
  const { start, end, label, prev, next } = monthInfo(monthParam);

  const supabase = await createClient();

  const [{ data: store }, { storeId: ownStoreId, stores }, { data: rows }] =
    await Promise.all([
      supabase.from("stores").select("*").eq("id", storeId).maybeSingle(),
      getStoreContext(supabase),
      supabase
        .from("daily_closings")
        .select("*")
        .eq("store_id", storeId)
        .gte("date", start)
        .lte("date", end),
    ]);

  if (!store) {
    notFound();
  }

  const isMaster = stores.length > 1;
  const isOwnStore = !isMaster && ownStoreId === storeId;

  const recordsByDate: Record<string, DailyClosing> = Object.fromEntries(
    (rows ?? []).map((r) => [r.date, r])
  );
  const monthTotal = (rows ?? []).reduce((sum, r) => sum + r.grand_total, 0);
  const days = daysInMonthKST(start);
  const today = kstDateString(0);
  const color = storeColor(store.name);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="text-sm font-medium text-muted">
        ‹ 홈
      </Link>
      <h1 className="text-lg font-bold">{store.name} 마감 내역</h1>

      <div className="flex items-center justify-between text-sm font-medium">
        <Link
          href={`/store/${storeId}?month=${prev}`}
          className="rounded-full border border-border px-2.5 py-1 text-muted"
        >
          ‹
        </Link>
        <span>
          {label} · 총 {formatWon(monthTotal)}
        </span>
        <Link
          href={`/store/${storeId}?month=${next}`}
          className="rounded-full border border-border px-2.5 py-1 text-muted"
        >
          ›
        </Link>
      </div>

      <ClosingCalendar
        days={days}
        recordsByDate={recordsByDate}
        editable={isOwnStore}
        accentColor={color}
        todayDate={today}
      />
    </div>
  );
}
