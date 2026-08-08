import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import {
  kstDateLabel,
  kstDateString,
  kstShortDateLabel,
  last7DaysKST,
  monthRangeKST,
} from "@/lib/date";
import DashboardChart, { type ChartPoint } from "@/components/DashboardChart";
import MultiStoreChart, { type MultiStorePoint, type StoreSeries } from "@/components/MultiStoreChart";
import QuickMenu from "@/components/QuickMenu";
import MonthlyPlanCalendar from "@/components/MonthlyPlanCalendar";
import MonthlyPlanAlerts from "@/components/MonthlyPlanAlerts";
import type { PlanComment, PlanFollower } from "@/components/MonthlyPlanDetail";
import PushSubscribeButton from "@/components/PushSubscribeButton";
import { getStoreContext, isHanamStore } from "@/lib/store";
import { storeColor } from "@/lib/storeColors";
import { avatarPublicUrl } from "@/lib/avatar";
import type { DailyClosing } from "@/lib/types";

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
  const { storeId, storeName, stores } = await getStoreContext(supabase);
  const isHanam = isHanamStore(storeName);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("department").eq("id", user.id).single()
    : { data: null };
  const isTeamAccount = !!profile?.department;
  const isMaster = stores.length > 1 && !isTeamAccount;
  const isHq = isMaster || isTeamAccount;

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

  const chartData: ChartPoint[] = days.map((date) => ({
    label: kstDateLabel(date),
    sales: byDate.get(date)?.grand_total ?? 0,
  }));

  let storeTodaySales: { id: string; name: string; sales: number }[] = [];
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

let monthlyPlans: import("@/lib/types").MonthlyPlan[] = [];
let commentsByPlan: Record<string, PlanComment[]> = {};
let followersByPlan: Record<string, PlanFollower[]> = {};
let hqProfiles: { id: string; name: string }[] = [];

if (isHq) {
  const [{ data: plans }, { data: hqProfileRows }] = await Promise.all([
    supabase.from("monthly_plans").select("*").order("start_date", { ascending: true }),
    supabase.from("profiles").select("id, name").is("store_id", null),
  ]);
  monthlyPlans = plans ?? [];
  hqProfiles = (hqProfileRows ?? []).sort((a, b) =>
    a.name === "대표님" ? -1 : b.name === "대표님" ? 1 : 0
  );

  const planIds = monthlyPlans.map((p) => p.id);
  if (planIds.length > 0) {
    const { data: followerRows } = await supabase
      .from("monthly_plan_followers")
      .select("*")
      .in("plan_id", planIds);
    const hqNameById = new Map(hqProfiles.map((p) => [p.id, p.name]));
    followersByPlan = {};
    for (const f of followerRows ?? []) {
      const list = followersByPlan[f.plan_id] ?? [];
      list.push({ userId: f.user_id, name: hqNameById.get(f.user_id) ?? "알 수 없음", confirmed: f.confirmed });
      followersByPlan[f.plan_id] = list;
    }
  }
  if (planIds.length > 0) {
    const { data: comments } = await supabase
      .from("monthly_plan_comments")
      .select("*")
      .in("plan_id", planIds)
      .order("created_at", { ascending: true });
    const commentRows = comments ?? [];
    const commentIds = commentRows.map((c) => c.id);

    const [{ data: attachments }, { data: profiles }, { data: avatarProfiles }] = await Promise.all([
      commentIds.length > 0
        ? supabase.from("monthly_plan_attachments").select("*").in("comment_id", commentIds)
        : Promise.resolve({ data: [] as { id: string; comment_id: string; storage_path: string; file_name: string }[] }),
      supabase.from("profiles").select("id, name"),
      // avatar_path는 name과 별도 쿼리로 조회한다. 같은 select에 묶으면 마이그레이션
      // 전 환경에서는 쿼리 전체가 실패해서 이름 표시까지 깨진다.
      supabase.from("profiles").select("id, avatar_path"),
    ]);

    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));
    const avatarById = new Map(
      (avatarProfiles ?? []).map((p) => [p.id, avatarPublicUrl(p.avatar_path)])
    );

    const signedUrlByPath = new Map<string, string>();
    if ((attachments ?? []).length > 0) {
      const { data: signedUrls } = await supabase.storage
        .from("monthly-plans")
        .createSignedUrls((attachments ?? []).map((a) => a.storage_path), 3600);
      for (const s of signedUrls ?? []) {
        if (s.signedUrl) signedUrlByPath.set(s.path ?? "", s.signedUrl);
      }
    }

    const attachmentsByComment = new Map<
      string,
      { id: string; file_name: string; url?: string }[]
    >();
    for (const a of attachments ?? []) {
      const list = attachmentsByComment.get(a.comment_id) ?? [];
      list.push({ id: a.id, file_name: a.file_name, url: signedUrlByPath.get(a.storage_path) });
      attachmentsByComment.set(a.comment_id, list);
    }

    commentsByPlan = {};
    for (const c of commentRows) {
      const list = commentsByPlan[c.plan_id] ?? [];
      list.push({
        id: c.id,
        body: c.body,
        created_by: c.created_by,
        created_at: c.created_at,
        authorName: nameById.get(c.created_by) ?? "알 수 없음",
        authorAvatarUrl: avatarById.get(c.created_by),
        attachments: attachmentsByComment.get(c.id) ?? [],
      });
      commentsByPlan[c.plan_id] = list;
    }
  }
}

  if (isMaster || isTeamAccount) {
    const thisMonth = monthRangeKST(0);
    const lastMonth = monthRangeKST(1);
    const dayOfMonth = Number(today.slice(8, 10));
    const lastMonthLastDay = Number(lastMonth.end.slice(8, 10));
    const lastMonthMtdEnd = `${lastMonth.start.slice(0, 7)}-${String(
      Math.min(dayOfMonth, lastMonthLastDay)
    ).padStart(2, "0")}`;

    const [
      { data: todayRows },
      { data: last7Rows },
      { data: thisMonthRows },
      { data: lastMonthRows },
    ] = await Promise.all([
      supabase.from("daily_closings").select("store_id, grand_total").eq("date", today),
      supabase
        .from("daily_closings")
        .select("date, store_id, grand_total")
        .gte("date", days[0])
        .lte("date", today),
      supabase
        .from("daily_closings")
        .select("store_id, grand_total")
        .gte("date", thisMonth.start)
        .lte("date", today),
      supabase
        .from("daily_closings")
        .select("store_id, grand_total")
        .gte("date", lastMonth.start)
        .lte("date", lastMonthMtdEnd),
    ]);

    const todayMap = sumByStore(todayRows);
    const thisMonthMap = sumByStore(thisMonthRows);
    const lastMonthMap = sumByStore(lastMonthRows);

    storeTodaySales = stores.map((s) => ({
      id: s.id,
      name: s.name,
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
      color: storeColor(s.name),
    }));

    storeMonthCompare = stores.map((s) => {
      const thisMonthSales = thisMonthMap.get(s.id) ?? 0;
      const lastMonthSales = lastMonthMap.get(s.id) ?? 0;
      return {
        id: s.id,
        name: s.name,
        color: storeColor(s.name),
        thisMonth: thisMonthSales,
        lastMonth: lastMonthSales,
        mom: momLabel(thisMonthSales, lastMonthSales),
      };
    });
  }

  if (isTeamAccount) {
    return (
      <div className="flex flex-col gap-5">
        <PushSubscribeButton storeId={null} />
        <MonthlyPlanAlerts plans={monthlyPlans} />
        <MonthlyPlanCalendar
          plans={monthlyPlans}
          commentsByPlan={commentsByPlan}
          followersByPlan={followersByPlan}
          hqProfiles={hqProfiles}
          currentUserId={user?.id}
        />

        <QuickMenu
          teamOnly
          showHr={profile?.department === "rnd" || profile?.department === "ops"}
          showInventory={profile?.department === "rnd"}
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

      {isMaster && (
        <>
          <MonthlyPlanAlerts plans={monthlyPlans} />
          <MonthlyPlanCalendar
            plans={monthlyPlans}
            commentsByPlan={commentsByPlan}
            followersByPlan={followersByPlan}
            hqProfiles={hqProfiles}
            currentUserId={user?.id}
          />
        </>
      )}

      {isMaster ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">실시간매출</h2>
            <span className="text-2xl font-bold text-foreground">{todayLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {storeTodaySales.map((s) => (
              <Link
                key={s.id}
                href={`/store/${s.id}`}
                style={{ backgroundColor: storeColor(s.name) }}
                className="rounded-2xl p-4 text-white shadow-lg transition-opacity active:opacity-80"
              >
                <p className="text-xs leading-tight text-white/85">{s.name}</p>
                <p className="mt-1 text-lg font-bold">{formatWon(s.sales)}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <Link
          href={`/store/${storeId}`}
          className="block rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-5 text-white shadow-lg shadow-brand/25 transition-opacity active:opacity-90"
        >
          <div className="flex items-center justify-between text-sm text-white/80">
            <span>오늘 매출</span>
            <span>{todayLabel}</span>
          </div>
          <p className="mt-1 text-3xl font-bold">{formatWon(todaySales)}</p>
          <div className="mt-4 flex items-center justify-between border-t border-white/20 pt-3">
            <span className="text-sm text-white/80">
              {isHanam ? "오늘 방문팀" : "오늘 총객수"}
            </span>
            <span className="text-lg font-semibold">
              {isHanam
                ? `${todayVisitTeams.toLocaleString()}팀`
                : `${todayGuests.toLocaleString()}명`}
            </span>
          </div>
        </Link>
      )}

      <QuickMenu isMaster={isMaster} />

      {!isMaster && !todayClosing && (
        <Link
          href="/closing"
          className="flex items-center justify-between rounded-2xl border border-brand-light bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark"
        >
          아직 오늘 마감을 입력하지 않았어요
          <span aria-hidden>→</span>
        </Link>
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
