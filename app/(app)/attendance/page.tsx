import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { kstDateString } from "@/lib/date";
import AttendanceClock from "@/components/AttendanceClock";
import AttendanceDayBoard from "@/components/AttendanceDayBoard";

// KST 기준 하루의 시작/끝(UTC ISO). recorded_at 비교에 쓴다.
function kstDayBounds(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { stores, storeId: contextStoreId }] = await Promise.all([
    supabase.from("profiles").select("store_id, role, department").eq("id", user.id).single(),
    getStoreContext(supabase),
  ]);

  // 출퇴근을 찍는 사람은 "소속 매장이 있는 계정"(직원·지점장). 본사 마스터는
  // 소속 매장이 없어서 기록 화면 대신 관리 화면만 본다.
  const myStoreId = profile?.store_id ?? null;
  const isManager = !profile?.department && (profile?.role === "owner" || !myStoreId);
  const today = kstDateString(0);
  const { start, end } = kstDayBounds(today);

  const [{ data: location }, { data: todayRecords }] = myStoreId
    ? await Promise.all([
        supabase.from("store_locations").select("*").eq("store_id", myStoreId).maybeSingle(),
        supabase
          .from("attendance_records")
          .select("*")
          .eq("user_id", user.id)
          .gte("recorded_at", start)
          .lt("recorded_at", end)
          .order("recorded_at"),
      ])
    : [{ data: null }, { data: [] }];

  const myStoreName = stores.find((s) => s.id === myStoreId)?.name ?? "";
  const adminStoreId = myStoreId ?? contextStoreId;
  const boardDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today ? dateParam : today;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">출퇴근</h1>
        <p className="mt-1 text-xs text-muted">매장 반경 안에서만 출근·퇴근이 기록돼요.</p>
      </div>

      {myStoreId ? (
        <AttendanceClock
          storeName={myStoreName}
          location={location ?? null}
          todayRecords={todayRecords ?? []}
        />
      ) : (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">
          본사 계정은 출퇴근을 찍지 않아요. 아래에서 매장별 기록을 보거나 매장 위치를 설정할 수 있어요.
        </p>
      )}

      {isManager && adminStoreId && (
        <AttendanceDayBoard supabase={supabase} storeId={adminStoreId} date={boardDate} />
      )}

      {isManager && (
        <section className="grid grid-cols-2 gap-2">
          <Link
            href="/attendance/records"
            className="rounded-2xl border border-border bg-card px-3 py-3 text-center text-sm font-semibold"
          >
            근태 기록 보기
          </Link>
          <Link
            href="/attendance/settings"
            className="rounded-2xl border border-border bg-card px-3 py-3 text-center text-sm font-semibold"
          >
            매장 위치 설정
          </Link>
        </section>
      )}
    </div>
  );
}
