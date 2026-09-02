import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { kstDateString, kstWeekday } from "@/lib/date";
import { getStoreContext, isHanamStore } from "@/lib/store";
import { storeColor } from "@/lib/storeColors";

// 요일별 분석 — "쉬는 날 없이 도는데 어느 요일이 인건비만 태우고 있나"를
// 보려고 만든 화면. 최근 12주 마감 데이터를 요일별로 평균 내서 비교한다.
const WEEKS = 12;
const DAYS = WEEKS * 7;

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

// kstWeekday는 0=일 ~ 6=토로 주므로 월요일 시작 인덱스로 바꾼다.
function mondayIndex(dateStr: string): number {
  return (kstWeekday(dateStr) + 6) % 7;
}

type Bucket = {
  days: number;
  sales: number;
  lunchGuests: number;
  dinnerGuests: number;
  lunchTeams: number;
  dinnerTeams: number;
  visitTeams: number;
};

function emptyBucket(): Bucket {
  return {
    days: 0,
    sales: 0,
    lunchGuests: 0,
    dinnerGuests: 0,
    lunchTeams: 0,
    dinnerTeams: 0,
    visitTeams: 0,
  };
}

function avg(total: number, days: number): number {
  return days === 0 ? 0 : total / days;
}

type WeekdayRow = {
  date: string;
  grand_total: number;
  lunch_guests: number | null;
  dinner_guests: number | null;
  lunch_teams: number | null;
  dinner_teams: number | null;
  visit_teams: number | null;
};

type WeekdayRowView = {
  label: string;
  days: number;
  dailySales: number;
  dailyGuests: number;
  dailyLunchGuests: number;
  dailyDinnerGuests: number;
  dailyTeams: number;
  perGuest: number;
};

type WeekdayStats = {
  openDays: number;
  rowsView: WeekdayRowView[];
  maxSales: number;
  weakest: WeekdayRowView;
  strongest: WeekdayRowView;
  avgDaily: number;
  gapPct: number;
  lossIfClosed: number;
};

function computeWeekdayStats(rows: WeekdayRow[], hanam: boolean): WeekdayStats | null {
  const buckets: Bucket[] = WEEKDAY_LABELS.map(() => emptyBucket());

  for (const r of rows) {
    // 마감은 입력됐지만 매출이 0인 날(휴무일 등)은 평균을 왜곡시키므로 뺀다.
    if (!r.grand_total) continue;
    const b = buckets[mondayIndex(r.date)];
    b.days += 1;
    b.sales += r.grand_total;
    b.lunchGuests += r.lunch_guests ?? 0;
    b.dinnerGuests += r.dinner_guests ?? 0;
    b.lunchTeams += r.lunch_teams ?? 0;
    b.dinnerTeams += r.dinner_teams ?? 0;
    b.visitTeams += r.visit_teams ?? 0;
  }

  const openDays = buckets.reduce((a, b) => a + b.days, 0);
  if (openDays === 0) return null;

  const rowsView: WeekdayRowView[] = WEEKDAY_LABELS.map((label, i) => {
    const b = buckets[i];
    const dailySales = avg(b.sales, b.days);
    const guests = b.lunchGuests + b.dinnerGuests;
    const teams = hanam ? b.visitTeams : b.lunchTeams + b.dinnerTeams;
    return {
      label,
      days: b.days,
      dailySales,
      dailyGuests: avg(guests, b.days),
      dailyLunchGuests: avg(b.lunchGuests, b.days),
      dailyDinnerGuests: avg(b.dinnerGuests, b.days),
      dailyTeams: avg(teams, b.days),
      // 객단가는 실제 기록된 객수로만 계산 — 객수 미입력일이 섞이면 왜곡되므로 0 처리.
      perGuest: guests === 0 ? 0 : b.sales / guests,
    };
  });

  const withData = rowsView.filter((r) => r.days > 0);
  const maxSales = Math.max(...withData.map((r) => r.dailySales));
  const weakest = withData.reduce((a, b) => (b.dailySales < a.dailySales ? b : a));
  const strongest = withData.reduce((a, b) => (b.dailySales > a.dailySales ? b : a));

  const totalSales = buckets.reduce((a, b) => a + b.sales, 0);
  const avgDaily = avg(totalSales, openDays);
  const gapPct =
    strongest.dailySales === 0
      ? 0
      : ((strongest.dailySales - weakest.dailySales) / strongest.dailySales) * 100;

  // 가장 약한 요일을 쉬면 매출은 얼마나 빠지나 — 그 요일 손님의 절반이
  // 다른 요일로 옮겨온다고 보수적으로 가정했을 때의 월 매출 영향.
  const weakestMonthly = weakest.dailySales * (weakest.days / WEEKS) * (30 / 7);
  const lossIfClosed = weakestMonthly * 0.5;

  return { openDays, rowsView, maxSales, weakest, strongest, avgDaily, gapPct, lossIfClosed };
}

function WeekdayStoreSection({
  storeName,
  hanam,
  stats,
}: {
  storeName: string;
  hanam: boolean;
  stats: WeekdayStats | null;
}) {
  const color = storeColor(storeName);

  if (!stats) {
    return (
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold">{storeName}</h2>
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">
          최근 {WEEKS}주 안에 마감 데이터가 없습니다.
        </p>
      </div>
    );
  }

  const { openDays, rowsView, maxSales, weakest, strongest, avgDaily, gapPct, lossIfClosed } = stats;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold">{storeName}</h2>
        <p className="text-xs text-muted">
          최근 {WEEKS}주 · 영업 {openDays}일 기준 (매출 0원인 날 제외)
        </p>
      </div>

      <div style={{ backgroundColor: color }} className="rounded-2xl p-4 text-white shadow-lg">
        <p className="text-xs text-white/85">일평균 매출</p>
        <p className="mt-1 text-2xl font-bold">{formatWon(Math.round(avgDaily))}</p>
        <div className="mt-3 flex items-center justify-between border-t border-white/25 pt-2 text-[11px] text-white/90">
          <span>
            최고 {strongest.label}요일 {formatWon(Math.round(strongest.dailySales))}
          </span>
          <span>
            최저 {weakest.label}요일 {formatWon(Math.round(weakest.dailySales))}
          </span>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">요일별 일평균 매출</h3>
        <div className="flex flex-col gap-2">
          {rowsView.map((r) => {
            const pct = maxSales === 0 ? 0 : (r.dailySales / maxSales) * 100;
            const isWeakest = r.days > 0 && r.label === weakest.label;
            return (
              <div key={r.label} className="flex items-center gap-3">
                <span
                  className={`w-5 shrink-0 text-xs ${
                    isWeakest ? "font-bold text-red-500" : "text-muted"
                  }`}
                >
                  {r.label}
                </span>
                <div className="h-5 flex-1 rounded-full bg-black/5 dark:bg-white/10">
                  <div
                    className="h-5 rounded-full"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      backgroundColor: isWeakest ? "#ef4444" : color,
                    }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-xs tabular-nums text-foreground">
                  {r.days === 0 ? "-" : formatWon(Math.round(r.dailySales))}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">요일별 상세</h3>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[430px] text-xs tabular-nums">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 text-left font-medium">요일</th>
                <th className="py-2 text-right font-medium">영업일</th>
                <th className="py-2 text-right font-medium">일평균 매출</th>
                {hanam ? (
                  <th className="py-2 text-right font-medium">방문팀</th>
                ) : (
                  <>
                    <th className="py-2 text-right font-medium">점심 객수</th>
                    <th className="py-2 text-right font-medium">저녁 객수</th>
                  </>
                )}
                <th className="py-2 text-right font-medium">객단가</th>
              </tr>
            </thead>
            <tbody>
              {rowsView.map((r) => {
                const isWeakest = r.days > 0 && r.label === weakest.label;
                return (
                  <tr
                    key={r.label}
                    className={`border-b border-border/60 last:border-0 ${
                      isWeakest ? "font-semibold text-red-500" : ""
                    }`}
                  >
                    <td className="py-2 text-left">{r.label}</td>
                    <td className="py-2 text-right">{r.days}</td>
                    <td className="py-2 text-right">
                      {r.days === 0 ? "-" : formatWon(Math.round(r.dailySales))}
                    </td>
                    {hanam ? (
                      <td className="py-2 text-right">{r.dailyTeams.toFixed(1)}</td>
                    ) : (
                      <>
                        <td className="py-2 text-right">{r.dailyLunchGuests.toFixed(1)}</td>
                        <td className="py-2 text-right">{r.dailyDinnerGuests.toFixed(1)}</td>
                      </>
                    )}
                    <td className="py-2 text-right">
                      {r.perGuest === 0 ? "-" : formatWon(Math.round(r.perGuest))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">휴무일 검토</h3>
        <div className="flex flex-col gap-2 text-xs leading-relaxed text-muted">
          <p>
            가장 약한 요일은{" "}
            <span className="font-semibold text-foreground">{weakest.label}요일</span>로, 일평균{" "}
            {formatWon(Math.round(weakest.dailySales))}입니다. 가장 센 {strongest.label}요일보다{" "}
            <span className="font-semibold text-foreground">{gapPct.toFixed(0)}% 낮습니다.</span>
          </p>
          <p>
            {weakest.label}요일을 정기휴무로 돌릴 경우, 그날 손님의 절반이 다른 요일로 옮겨온다고
            보수적으로 잡으면 월 매출 영향은 약{" "}
            <span className="font-semibold text-foreground">
              {formatWon(Math.round(lossIfClosed))}
            </span>{" "}
            감소입니다. 이 금액보다 하루치 인건비 절감액이 크면 휴무 전환이 유리하고, 작으면
            지금처럼 여는 게 맞습니다.
          </p>
          <p className="text-[11px]">
            요일 간 차이가 20% 미만이면 특정 요일이 문제인 게 아니라 전 요일에 걸쳐 손님이
            부족한 것이므로, 휴무일 조정보다 유입 개선이 먼저입니다.
          </p>
        </div>
      </section>
    </div>
  );
}

export default async function WeekdayAnalysisPage() {
  const supabase = await createClient();
  const { storeId, storeName, stores } = await getStoreContext(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("department").eq("id", user.id).single()
    : { data: null };
  // 팀 계정은 애초에 이 라우트에 못 들어오니(레이아웃 가드) 여기선 store_id
  // 없는 계정 = 마스터로만 취급하면 된다.
  const isMaster = stores.length > 1 && !profile?.department;

  const start = kstDateString(DAYS);
  const end = kstDateString(0);

  if (isMaster) {
    const { data: rows } = await supabase
      .from("daily_closings")
      .select(
        "store_id, date, grand_total, lunch_guests, dinner_guests, lunch_teams, dinner_teams, visit_teams"
      )
      .gte("date", start)
      .lte("date", end);

    const rowsByStore = new Map<string, WeekdayRow[]>();
    for (const r of rows ?? []) {
      const list = rowsByStore.get(r.store_id) ?? [];
      list.push(r);
      rowsByStore.set(r.store_id, list);
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold">요일별 분석</h1>
          <p className="text-xs text-muted">전체 매장 · 최근 {WEEKS}주 (매출 0원인 날 제외)</p>
        </div>

        {stores.map((s, i) => (
          <div key={s.id} className={i > 0 ? "border-t border-border pt-6" : ""}>
            <WeekdayStoreSection
              storeName={s.name}
              hanam={isHanamStore(s.name)}
              stats={computeWeekdayStats(rowsByStore.get(s.id) ?? [], isHanamStore(s.name))}
            />
          </div>
        ))}
      </div>
    );
  }

  const hanam = isHanamStore(storeName);

  const { data: rows } = await supabase
    .from("daily_closings")
    .select(
      "date, grand_total, lunch_guests, dinner_guests, lunch_teams, dinner_teams, visit_teams"
    )
    .eq("store_id", storeId)
    .gte("date", start)
    .lte("date", end);

  const stats = computeWeekdayStats(rows ?? [], hanam);

  if (!stats) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-bold">요일별 분석</h1>
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">
          최근 {WEEKS}주 안에 {storeName}의 마감 데이터가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold">요일별 분석</h1>
      <WeekdayStoreSection storeName={storeName} hanam={hanam} stats={stats} />
    </div>
  );
}
