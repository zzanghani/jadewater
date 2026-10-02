import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { kstDateString, kstShortDateLabel, kstWeekdayShortLabel } from "@/lib/date";
import AttendanceCsvButton, { type AttendanceCsvRow } from "@/components/AttendanceCsvButton";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function kstParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

// 매장별·기간별 근태 조회 (사양서 8장). 지점장은 자기 매장, 마스터는
// 상단 매장 선택(쿠키)에 따른 매장을 본다.
export default async function AttendanceRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; flagged?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { storeId, storeName }] = await Promise.all([
    supabase.from("profiles").select("store_id, role, department").eq("id", user.id).single(),
    getStoreContext(supabase),
  ]);
  const isManager = !profile?.department && (profile?.role === "owner" || !profile?.store_id);
  if (!isManager) redirect("/attendance");

  const to = params.to && DATE_RE.test(params.to) ? params.to : kstDateString(0);
  const from = params.from && DATE_RE.test(params.from) ? params.from : kstDateString(6);
  const flaggedOnly = params.flagged === "1";

  const start = new Date(`${from}T00:00:00+09:00`).toISOString();
  const end = new Date(new Date(`${to}T00:00:00+09:00`).getTime() + 86_400_000).toISOString();

  let query = supabase
    .from("attendance_records")
    .select("*")
    .eq("store_id", storeId)
    .gte("recorded_at", start)
    .lt("recorded_at", end)
    .order("recorded_at", { ascending: false });
  if (flaggedOnly) query = query.eq("flagged", true);
  const { data: records } = await query;

  const userIds = Array.from(new Set((records ?? []).map((r) => r.user_id)));
  const { data: people } = userIds.length
    ? await supabase.from("profiles").select("id, name").in("id", userIds)
    : { data: [] };
  const nameById = new Map((people ?? []).map((p) => [p.id, p.name ?? ""]));

  const rows: AttendanceCsvRow[] = (records ?? []).map((r) => {
    const { date, time } = kstParts(r.recorded_at);
    return {
      date,
      time,
      name: nameById.get(r.user_id) ?? "",
      type: r.type === "IN" ? "출근" : "퇴근",
      distance_m: r.distance_m,
      accuracy_m: r.accuracy_m,
      radius_m: r.store_radius_m,
      flagged: r.flagged,
    };
  });

  // 날짜별로 묶어서 보여준다.
  const byDate = new Map<string, AttendanceCsvRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }

  const flaggedHref = `/attendance/records?from=${from}&to=${to}${flaggedOnly ? "" : "&flagged=1"}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/attendance" className="text-xs text-muted">
          ‹ 출퇴근
        </Link>
        <h1 className="mt-1 text-lg font-bold">근태 기록</h1>
        <p className="mt-1 text-xs text-muted">{storeName}</p>
      </div>

      <form className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-2 py-2 text-sm"
          />
          <span className="text-xs text-muted">~</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-2 py-2 text-sm"
          />
          {flaggedOnly && <input type="hidden" name="flagged" value="1" />}
          <button type="submit" className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white">
            조회
          </button>
        </div>
        <div className="flex items-center justify-between">
          <Link
            href={flaggedHref}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              flaggedOnly ? "border-amber-500 bg-amber-50 text-amber-700" : "border-border text-muted"
            }`}
          >
            반경 밖 기록만
          </Link>
          <AttendanceCsvButton rows={rows} filename={`근태_${storeName}_${from}_${to}.csv`} />
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">이 기간에는 기록이 없어요.</p>
      ) : (
        Array.from(byDate.entries()).map(([date, list]) => (
          <section key={date} className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-bold">
              {kstShortDateLabel(date)} ({kstWeekdayShortLabel(date)})
            </h2>
            <ul className="flex flex-col gap-1.5">
              {list.map((r, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="font-semibold">{r.name || "(이름 없음)"}</span>
                    <span className={`ml-2 text-xs ${r.type === "출근" ? "text-green-700" : "text-blue-700"}`}>
                      {r.type}
                    </span>
                    {r.flagged && (
                      <span className="ml-1.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        반경 밖
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {r.time} · {r.distance_m}m (±{r.accuracy_m})
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
