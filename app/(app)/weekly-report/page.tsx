import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { weekRangeLabel } from "@/lib/date";

export default async function WeeklyReportPage() {
  const supabase = await createClient();
  const { storeId, stores } = await getStoreContext(supabase);
  const isMaster = stores.length > 1;

  let query = supabase
    .from("weekly_reports")
    .select("id, store_id, week_start, created_at")
    .order("week_start", { ascending: false });

  if (!isMaster) {
    query = query.eq("store_id", storeId);
  }

  const { data: reports } = await query.limit(30);
  const rows = reports ?? [];

  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">주간보고</h1>
        {!isMaster && (
          <Link
            href="/weekly-report/write"
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand/30"
          >
            이번주 작성
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">아직 등록된 주간보고가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/weekly-report/${r.id}`}
                className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{weekRangeLabel(r.week_start)}</p>
                  {isMaster && (
                    <span className="rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand">
                      {storeNameById.get(r.store_id) ?? "알 수 없음"}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
