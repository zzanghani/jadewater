import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import {
  kstDateLabel,
  kstDateString,
  kstShortDateLabel,
  last7DaysKST,
  monthRangeKST,
  shiftDateString,
} from "@/lib/date";
import DashboardChart, { type ChartPoint } from "@/components/DashboardChart";
import MultiStoreChart, { type MultiStorePoint, type StoreSeries } from "@/components/MultiStoreChart";
import QuickMenu from "@/components/QuickMenu";
import LiveStoreSalesGrid from "@/components/LiveStoreSalesGrid";
import LiveSalesHero from "@/components/LiveSalesHero";
import MonthlyTargetTable from "@/components/MonthlyTargetTable";
import { adReportAllowed } from "@/lib/adAccess";
import UpcomingPlansStrip from "@/components/UpcomingPlansStrip";
import { loadHqProfiles, type HqProfile } from "@/lib/monthlyPlans";
import PushSubscribeButton from "@/components/PushSubscribeButton";
import ScheduleDayTimeline from "@/components/ScheduleDayTimeline";
import { getStoreContext } from "@/lib/store";
import { storeColor } from "@/lib/storeColors";
import type { DailyClosing, MonthlyPlan } from "@/lib/types";

function sumByStore(rows: { store_id: string; grand_total: number }[] | null) {
  const map = new Map<string, number>();
  for (const r of rows ?? []) {
    map.set(r.store_id, (map.get(r.store_id) ?? 0) + r.grand_total);
  }
  return map;
}

function momLabel(current: number, prev: number): string {
  if (prev === 0) return current === 0 ? "-" : "신규";
  const pct = ((current - prev) / prev) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { storeId, store, stores } = await getStoreContext(supabase);
  const isHanam = !(store?.uses_service_split ?? true);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("department, role").eq("id", user.id).single()
    : { data: null };
  const isTeamAccount = !!profile?.department;
  const isMaster = stores.length > 1 && !isTeamAccount;
  const isHq = isMaster || isTeamAccount;
  const isEmployee = !isTeamAccount && !isMaster && profile?.role === "staff";

  const { count: pendingAccountCount } = isMaster
    ? await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
    : { count: 0 };

  const days = last7DaysKST();
  const today = kstDateString(0);
  const todayLabel = kstShortDateLabel(today);

  const { data: closings } = isTeamAccount
    ? { data: [] }
    : await supabase
        .from("daily_closings")
        .select("*")
        .eq("store_id", storeId)
        .gte("date", days[0])
        .lte("date", today)
        .order("date", { ascending: true });

  const byDate = new Map<string, DailyClosing>(
    (closings ?? []).map((c) => [c.date, c])
  );

  const todayClosing = byDate.get(today);
  const todaySales = todayClosing?.grand_total ?? 0;
  const todayGuests = todayClosing?.total_guests ?? 0;
  const todayVisitTeams = todayClosing?.visit_teams ?? 0;

  // 직원 계정은 스케줄러가 빠른 메뉴에 없는 대신, 오늘 매출 카드 바로
  // 아래에 오늘 스케줄을 미리보기로 보여주고 눌러서 전체 화면으로 간다.
  const { data: todayShifts } = isEmployee
    ? await supabase
        .from("schedule_shifts")
        .select("*")
        .eq("store_id", storeId)
        .eq("date", today)
        .order("created_at", { ascending: true })
    : { data: [] };

  const chartData: ChartPoint[] = days.map((date) => ({
    label: kstDateLabel(date),
    sales: byDate.get(date)?.grand_total ?? 0,
  }));

  let storeTodaySales: { id: string; name: string; color: string; sales: number }[] = [];
  let multiChartData: MultiStorePoint[] = [];
  let multiChartSeries: StoreSeries[] = [];
  let storeMonthCompare: {
    id: string;
    name: string;
    color: string;
    thisMonth: number;
    lastMonth: number;
    mom: string;
  }[] = [];

// 홈에는 "이번 주 일정" 띠만 — 오늘부터 7일 치 일정과 담당자 색만 가볍게 읽는다.
// 달력 전체·댓글·확인자는 /plan 화면에서(lib/monthlyPlans.ts loadHqPlanData).
let monthlyPlans: MonthlyPlan[] = [];
let hqProfiles: HqProfile[] = [];
if (isHq) {
  const [{ data: plans }, profiles] = await Promise.all([
    supabase
      .from("monthly_plans")
      .select("*")
      .gte("end_date", today)
      .lte("start_date", shiftDateString(today, 7))
      .order("start_date", { ascending: true }),
    loadHqProfiles(supabase),
  ]);
  monthlyPlans = plans ?? [];
  hqProfiles = profiles;
}

  if (isMaster || isTeamAccount) {
    const thisMonth = monthRangeKST(0);
    const lastMonth = monthRangeKST(1);
    const dayOfMonth = Number(today.slice(8, 10));
    const lastMonthLastDay = Number(lastMonth.end.slice(8, 10));
    const lastMonthMtdEnd = `${lastMonth.start.slice(0, 7)}-${String(
      Math.min(dayOfMonth, lastMonthLastDay)
    ).padStart(2, "0")}`;

    // daily_closings는 RLS상 팀 계정(department 있음)이 직접 못 읽어서,
    // 팀 계정도 볼 수 있는 이 홈 화면 위젯은 날짜/매장/총매출만 돌려주는
    // security definer 함수를 거친다(카드/현금 등 세부 매출은 여전히
    // 매장 계정 전용).
    const [
      { data: todayRows },
      { data: last7Rows },
      { data: thisMonthRows },
      { data: lastMonthRows },
    ] = await Promise.all([
      supabase.rpc("get_daily_closings_totals", { p_start: today, p_end: today }),
      supabase.rpc("get_daily_closings_totals", { p_start: days[0], p_end: today }),
      supabase.rpc("get_daily_closings_totals", { p_start: thisMonth.start, p_end: today }),
      supabase.rpc("get_daily_closings_totals", { p_start: lastMonth.start, p_end: lastMonthMtdEnd }),
    ]);

    const todayMap = sumByStore(todayRows);
    const thisMonthMap = sumByStore(thisMonthRows);
    const lastMonthMap = sumByStore(lastMonthRows);

    storeTodaySales = stores.map((s) => ({
      id: s.id,
      name: s.name,
      color: storeColor(s),
      sales: todayMap.get(s.id) ?? 0,
    }));

    const dailyByStore = new Map<string, Map<string, number>>();
    for (const r of last7Rows ?? []) {
      const dayMap = dailyByStore.get(r.date) ?? new Map<string, number>();
      dayMap.set(r.store_id, (dayMap.get(r.store_id) ?? 0) + r.grand_total);
      dailyByStore.set(r.date, dayMap);
    }
    multiChartData = days.map((date) => {
      const point: MultiStorePoint = { label: kstDateLabel(date) };
      for (const s of stores) {
        point[s.id] = dailyByStore.get(date)?.get(s.id) ?? 0;
      }
      return point;
    });
    multiChartSeries = stores.map((s) => ({
      key: s.id,
      name: s.name,
      color: storeColor(s),
    }));

    storeMonthCompare = stores.map((s) => {
      const thisMonthSales = thisMonthMap.get(s.id) ?? 0;
      const lastMonthSales = lastMonthMap.get(s.id) ?? 0;
      return {
        id: s.id,
        name: s.name,
        color: storeColor(s),
        thisMonth: thisMonthSales,
        lastMonth: lastMonthSales,
        mom: momLabel(thisMonthSales, lastMonthSales),
      };
    });
  }

  if (isTeamAccount) {
    // 마케팅팀은 마스터 홈과 같은 "실시간매출" 매장 카드를 본다. 카드를 누르면
    // 매장별 달력 + 마감보고(/store/[id])로 간다 — daily_closings 조회는
    // migration_marketing_view_closings.sql의 RLS(user_can_view_closings)로 열어 둠.
    const showStoreSalesCards = profile?.department === "marketing";
    return (
      <div className="flex flex-col gap-5">
        <PushSubscribeButton storeId={null} />
        <UpcomingPlansStrip plans={monthlyPlans} hqProfiles={hqProfiles} />

        {showStoreSalesCards && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">실시간매출</h2>
              <span className="text-2xl font-bold text-foreground">{todayLabel}</span>
            </div>
            <LiveStoreSalesGrid stores={storeTodaySales} />
          </section>
        )}

        <QuickMenu
          teamOnly
          showHr={profile?.department === "rnd" || profile?.department === "ops"}
          showInventory={profile?.department === "rnd"}
          showStoreOpsView={profile?.department === "rnd"}
        />

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">최근 7일 매출</h2>
          <MultiStoreChart data={multiChartData} series={multiChartSeries} />
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PushSubscribeButton storeId={isMaster ? null : storeId} />

      {/* 월 매출 목표 — 지점장·직원은 홈 맨 위에서 같은 숫자를 본다. 지점장이 정하고 직원은 보기만.
          마스터는 실시간매출 매장 타일 안의 달성률로 본다. */}
      {!isMaster && !isTeamAccount && <MonthlyTargetTable />}

      {isMaster && <UpcomingPlansStrip plans={monthlyPlans} hqProfiles={hqProfiles} />}

      {isMaster ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">실시간매출</h2>
            <span className="text-2xl font-bold text-foreground">{todayLabel}</span>
          </div>
          <LiveStoreSalesGrid stores={storeTodaySales} />
        </section>
      ) : (
        <LiveSalesHero
          storeId={storeId}
          todayLabel={todayLabel}
          closingSales={todaySales}
          guestsLabel={isHanam ? "오늘 방문팀" : "오늘 총객수"}
          guestsText={isHanam ? `${todayVisitTeams.toLocaleString()}팀` : `${todayGuests.toLocaleString()}명`}
        />
      )}

      {isEmployee && (
        <Link href="/schedule" className="block">
          {(todayShifts ?? []).length > 0 ? (
            <ScheduleDayTimeline shifts={todayShifts ?? []} />
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted">
              오늘 등록된 스케줄이 없어요
              <span aria-hidden>→</span>
            </div>
          )}
        </Link>
      )}

      <QuickMenu
        isMaster={isMaster}
        employeeOnly={isEmployee}
        pendingAccountCount={pendingAccountCount ?? 0}
        showAdReport={isMaster || adReportAllowed({ role: profile?.role ?? null, store_id: storeId ?? null, department: profile?.department ?? null }, store?.name)}
      />

      {!isMaster && (
        todayClosing ? (
          <div className="flex items-center justify-between rounded-2xl border border-brand-light bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark">
            마감완료, 오늘도 수고하셨습니다!
            <span aria-hidden>✅</span>
          </div>
        ) : (
          <Link
            href="/closing"
            className="flex items-center justify-between rounded-2xl border border-brand-light bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark"
          >
            아직 오늘 마감을 입력하지 않았어요
            <span aria-hidden>→</span>
          </Link>
        )
      )}

      {isMaster ? (
        <>
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              최근 7일 매출
            </h2>
            <MultiStoreChart data={multiChartData} series={multiChartSeries} />
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              전월 대비 이번달 매출
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-medium">매장</th>
                  <th className="pb-2 text-right font-medium">이번달</th>
                  <th className="pb-2 text-right font-medium">전달</th>
                  <th className="pb-2 text-right font-medium">증감률</th>
                </tr>
              </thead>
              <tbody>
                {storeMonthCompare.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </span>
                    </td>
                    <td className="py-2 text-right font-semibold text-foreground">
                      {formatWon(s.thisMonth)}
                    </td>
                    <td className="py-2 text-right text-muted">
                      {formatWon(s.lastMonth)}
                    </td>
                    <td className="py-2 text-right font-semibold">{s.mom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            최근 7일 매출
          </h2>
          <DashboardChart data={chartData} />
        </section>
      )}
    </div>
  );
}
