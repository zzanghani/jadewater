import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPush, webPushStatus } from "@/lib/webpush";
import { fetchGooglePlaceSnapshot } from "@/lib/googlePlaces";

// 앱 자동 점검(헬스체크).
// - 매일 아침 루틴(클라우드 에이전트)과 pg_cron(점심, supabase/migration_health_check.sql)이 호출한다.
// - DB가 살아 있는지(그린 무료플랜 자동 일시정지 감지), 핵심 테이블·RLS·pg_cron·푸시 설정을 점검하고
//   결과를 JSON으로 돌려준다. 이상이 있으면(또는 ?notify=always) 대표(owner) 계정 폰으로 웹푸시.
// - ?notify=always | problems(기본) | never, ?summary=<푸시 본문으로 쓸 한 줄(선택)>
// - 인증: Vercel CRON_SECRET 또는 Supabase Vault의 cron_secret (pg_cron·맥미니가 쓰는 값).
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type HealthSnapshot = {
  checked_at: string;
  rls_off_tables: string[];
  cron_jobs: {
    name: string;
    active: boolean;
    schedule: string;
    last_status: string | null;
    last_run: string | null;
    message: string | null;
  }[];
  cron_failures_24h: number;
  http_failures_24h: number;
  http_last_error: string | null;
  db_size_mb: number;
};

const DB_TIMEOUT_MS = 8000;

function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} ${ms}ms 안에 응답 없음`)), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((Date.now() - t) / 60000);
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

// 기능별 결과 테이블과 "이 시간 넘게 새 기록이 없으면 멈춘 것" 기준.
// - level problem: 자동 작업이라 끊기면 바로 고쳐야 함(푸시). warning: 사람 입력이라 쉬는 날일 수도 있음.
// - requires: 이 테이블에 행이 하나도 없으면 아직 안 쓰는 기능으로 보고 건너뜀(연동 전 매장 등).
// - 크론 주기(vercel.json·pg_cron)보다 넉넉하게 잡아 하루 한 번 도는 작업은 36시간, 주 1회는 8일.
type FeatureCheck = {
  label: string;
  table: string;
  column: string;
  maxHours: number;
  level: "problem" | "warning";
  requires?: string;
  hint?: string;
};

const FEATURE_CHECKS: FeatureCheck[] = [
  { label: "리뷰 수집", table: "review_platform_stats", column: "date", maxHours: 48, level: "problem", hint: "collect-reviews 크론·구글 Places 키 확인" },
  { label: "광고 일별 동기화", table: "ad_daily_stats", column: "synced_at", maxHours: 36, level: "problem", requires: "store_ad_accounts", hint: "네이버 광고 키·ad-insight-sync 확인" },
  { label: "광고 시간대 동기화", table: "ad_hourly_stats", column: "synced_at", maxHours: 36, level: "problem", requires: "store_ad_accounts", hint: "ad-insight-sync 크론 확인" },
  { label: "광고 키워드 동기화", table: "ad_keyword_daily_stats", column: "synced_at", maxHours: 36, level: "problem", requires: "ad_keyword_daily_stats", hint: "ad-keyword-sync 크론(23:55) 확인" },
  { label: "날씨 수집", table: "weather_daily", column: "synced_at", maxHours: 36, level: "problem", requires: "store_ad_accounts", hint: "ad-insight-sync 크론 확인" },
  { label: "광고 주간 리포트", table: "ad_weekly_reports", column: "generated_at", maxHours: 8 * 24, level: "problem", requires: "store_ad_accounts", hint: "ad-weekly-report 크론(일요일) 확인" },
  { label: "토스 매출 동기화", table: "toss_daily_sales", column: "synced_at", maxHours: 36, level: "problem", requires: "store_toss_merchants", hint: "토스 연동 키 확인" },
  { label: "토스 결제 수신(웹훅)", table: "toss_webhook_events", column: "received_at", maxHours: 30, level: "warning", requires: "store_toss_merchants", hint: "토스 웹훅 주소 확인" },
  { label: "출퇴근 알림 발송", table: "attendance_reminders", column: "sent_at", maxHours: 48, level: "warning", requires: "schedule_shifts", hint: "attendance-reminders pg_cron 확인" },
  { label: "주간보고 보관", table: "weekly_reports", column: "archived_at", maxHours: 8 * 24, level: "warning", requires: "weekly_reports", hint: "weekly-report-archive 크론 확인" },
  { label: "검색 노출 순위", table: "search_rank_daily", column: "checked_at", maxHours: 48, level: "warning", requires: "search_rank_daily", hint: "맥미니 작업기 확인" },
  { label: "출퇴근 기록", table: "attendance_records", column: "recorded_at", maxHours: 72, level: "warning" },
  { label: "마감입력", table: "daily_closings", column: "updated_at", maxHours: 72, level: "warning" },
  { label: "입금요청", table: "payment_requests", column: "created_at", maxHours: 7 * 24, level: "warning" },
  { label: "영수증", table: "receipts", column: "created_at", maxHours: 7 * 24, level: "warning" },
  { label: "재고 입력", table: "inventory_counts", column: "updated_at", maxHours: 7 * 24, level: "warning" },
  { label: "스케줄", table: "schedule_shifts", column: "updated_at", maxHours: 7 * 24, level: "warning" },
  { label: "게시판", table: "board_posts", column: "created_at", maxHours: 14 * 24, level: "warning" },
];

type FeatureResult = {
  label: string;
  last: string | null;
  hoursAgo: number | null;
  status: "정상" | "멈춤" | "미사용" | "조회 실패";
  level: "problem" | "warning";
  hint?: string;
  error?: string;
};

async function checkFeatureFreshness(supabase: ReturnType<typeof createServiceClient>): Promise<FeatureResult[]> {
  const requiredTables = [...new Set(FEATURE_CHECKS.map((f) => f.requires).filter((t): t is string => !!t))];
  const inUse = new Map<string, boolean>();
  await Promise.all(
    requiredTables.map(async (t) => {
      const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
      inUse.set(t, !error && (count ?? 0) > 0);
    })
  );
  return Promise.all(
    FEATURE_CHECKS.map(async (f): Promise<FeatureResult> => {
      const base = { label: f.label, level: f.level, hint: f.hint };
      if (f.requires && !inUse.get(f.requires)) return { ...base, last: null, hoursAgo: null, status: "미사용" };
      const { data, error } = await supabase
        .from(f.table)
        .select(f.column)
        .not(f.column, "is", null)
        .order(f.column, { ascending: false })
        .limit(1);
      if (error) return { ...base, last: null, hoursAgo: null, status: "조회 실패", error: error.message };
      const last = ((data?.[0] as Record<string, string> | undefined)?.[f.column] ?? null) as string | null;
      const min = minutesSince(last);
      const hoursAgo = min === null ? null : Math.round((min / 60) * 10) / 10;
      const stale = hoursAgo === null || hoursAgo > f.maxHours;
      return { ...base, last, hoursAgo, status: stale ? "멈춤" : "정상" };
    })
  );
}

function envLabel(): string {
  if (process.env.VERCEL_ENV === "production") return "블루";
  if (process.env.VERCEL_GIT_COMMIT_REF === "staging") return "그린";
  return process.env.VERCEL_ENV ?? "로컬";
}

export async function GET(request: Request) {
  const started = Date.now();
  const params = new URL(request.url).searchParams;
  const notify = params.get("notify") ?? "problems";
  // 아침 루틴이 린트·화면 점검 결과를 한 줄로 넘기면 푸시 본문에 그대로 싣는다.
  const summary = (params.get("summary") ?? "").trim().slice(0, 180);
  const authHeader = request.headers.get("authorization") ?? "";
  const env = envLabel();
  const problems: string[] = [];
  const warnings: string[] = [];
  const info: Record<string, unknown> = {};

  const supabase = createServiceClient();

  // 1) DB 생존 확인 겸 호출 토큰 읽기. 그린(무료플랜)이 자동 일시정지되면 여기서 바로 걸린다.
  let dbToken: string | null = null;
  let dbError: string | null = null;
  let dbMs = 0;
  try {
    const t0 = Date.now();
    const { data, error } = await withTimeout(supabase.rpc("attendance_cron_token"), DB_TIMEOUT_MS, "DB");
    dbMs = Date.now() - t0;
    if (error) dbError = error.message;
    else dbToken = data;
  } catch (e) {
    dbMs = Date.now() - started;
    dbError = errMsg(e);
  }

  const accepted = [process.env.CRON_SECRET, dbToken].filter(
    (t): t is string => typeof t === "string" && t.length > 0
  );
  if (accepted.length === 0 || !accepted.some((t) => authHeader === `Bearer ${t}`)) {
    // DB가 죽어서 토큰을 못 읽은 경우라도 호출자가 누군지 모르면 상세는 안 준다.
    return NextResponse.json(
      { error: "unauthorized", dbDown: Boolean(dbError) },
      { status: dbError && accepted.length === 0 ? 503 : 401 }
    );
  }

  info.dbMs = dbMs;
  if (dbError) {
    problems.push(`DB 응답 없음 (${dbError}) — 그린이면 무료플랜 자동 일시정지일 수 있음`);
  } else {
    if (dbMs > 3000) warnings.push(`DB 응답 느림 (${dbMs}ms)`);

    // 2) DB 쪽 스냅샷: RLS 꺼진 테이블, pg_cron, pg_net 실패
    try {
      const { data, error } = await withTimeout(supabase.rpc("health_snapshot"), DB_TIMEOUT_MS, "health_snapshot");
      if (error) {
        problems.push(`health_snapshot 함수 오류: ${error.message} (migration_health_check.sql 적용 필요?)`);
      } else if (data) {
        const snap = data as unknown as HealthSnapshot;
        info.snapshot = snap;
        if (snap.rls_off_tables?.length) problems.push(`RLS 꺼진 테이블: ${snap.rls_off_tables.join(", ")}`);
        if (snap.cron_failures_24h > 0) problems.push(`DB 크론 실패 24h: ${snap.cron_failures_24h}건`);
        for (const job of snap.cron_jobs ?? []) {
          if (!job.active) warnings.push(`DB 크론 '${job.name}' 비활성`);
          const ago = minutesSince(job.last_run);
          if (job.name === "attendance-reminders" && ago !== null && ago > 30) {
            problems.push(`출퇴근 알림 크론이 ${ago}분째 안 돎`);
          }
        }
        if (snap.http_failures_24h > 0) {
          warnings.push(`DB→앱 호출 실패 24h: ${snap.http_failures_24h}건${snap.http_last_error ? ` (${snap.http_last_error})` : ""}`);
        }
      }
    } catch (e) {
      problems.push(`health_snapshot 호출 실패: ${errMsg(e)}`);
    }

    // 3) 핵심 테이블이 읽히는지 + 최근 데이터 신선도
    try {
      const [stores, profiles, closings, attendance, subs, reviewStats] = await withTimeout(
        Promise.all([
          supabase.from("stores").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("daily_closings").select("date").order("date", { ascending: false }).limit(1),
          supabase
            .from("attendance_records")
            .select("recorded_at")
            .order("recorded_at", { ascending: false })
            .limit(1),
          supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
          supabase
            .from("review_platform_stats")
            .select("date")
            .order("date", { ascending: false })
            .limit(1),
        ]),
        DB_TIMEOUT_MS,
        "핵심 테이블"
      );
      for (const [label, r] of [
        ["stores", stores],
        ["profiles", profiles],
        ["daily_closings", closings],
        ["attendance_records", attendance],
        ["push_subscriptions", subs],
        ["review_platform_stats", reviewStats],
      ] as const) {
        if (r.error) problems.push(`${label} 조회 실패: ${r.error.message}`);
      }
      info.stores = stores.count ?? 0;
      info.profiles = profiles.count ?? 0;
      info.pushSubscriptions = subs.count ?? 0;
      if ((stores.count ?? 0) === 0) problems.push("매장(stores) 데이터가 없음");
      if ((profiles.count ?? 0) === 0) problems.push("계정(profiles) 데이터가 없음");

      const lastClosing = closings.data?.[0]?.date ?? null;
      const lastAttendance = attendance.data?.[0]?.recorded_at ?? null;
      const lastReviewCollect = reviewStats.data?.[0]?.date ?? null;
      info.lastClosing = lastClosing;
      info.lastAttendance = lastAttendance;
      info.lastReviewCollect = lastReviewCollect;
      // 마감·출퇴근·리뷰 수집이 끊겼는지는 아래 3-0 기능별 점검(FEATURE_CHECKS)이 함께 본다.
    } catch (e) {
      problems.push(`핵심 테이블 점검 실패: ${errMsg(e)}`);
    }

    // 3-0) 기능별 "마지막으로 결과가 쌓인 시각" — 자동 작업이 200을 돌려주고도 실제로는 아무것도
    //      못 쌓는 경우(리뷰 수집 11일 누락)를 잡기 위해 기능마다 결과 테이블을 직접 본다.
    //      결과는 info.features 표로 항상 돌려주고, 기준 시간을 넘긴 항목은 블루에서만 문제/경고로 올린다.
    try {
      const features = await withTimeout(checkFeatureFreshness(supabase), DB_TIMEOUT_MS, "기능별 점검");
      info.features = features.map((f) => ({ 기능: f.label, 마지막: f.last, 시간전: f.hoursAgo, 상태: f.status }));
      if (env === "블루") {
        for (const f of features) {
          if (f.status === "멈춤") {
            const msg = `${f.label} ${f.hoursAgo === null ? "기록 없음" : `${Math.round(f.hoursAgo)}시간째 안 됨`}${f.hint ? ` — ${f.hint}` : ""}`;
            if (f.level === "problem") problems.push(msg);
            else warnings.push(msg);
          } else if (f.status === "조회 실패") {
            warnings.push(`${f.label} 조회 실패: ${f.error}`);
          }
        }
      }
    } catch (e) {
      warnings.push(`기능별 점검 실패: ${errMsg(e)}`);
    }

    // 3-0-1) 매장별 마감입력 — 한 매장만 며칠째 마감을 안 쓰는 경우는 전체 최신 날짜로는 안 보인다.
    if (env === "블루") {
      try {
        const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const [{ data: storeRows }, { data: recent }] = await withTimeout(
          Promise.all([
            supabase.from("stores").select("id, name"),
            supabase.from("daily_closings").select("store_id, date").gte("date", since),
          ]),
          DB_TIMEOUT_MS,
          "매장별 마감"
        );
        const lastByStore = new Map<string, string>();
        for (const r of recent ?? []) {
          const prev = lastByStore.get(r.store_id);
          if (!prev || r.date > prev) lastByStore.set(r.store_id, r.date);
        }
        // 최근 7일 동안 한 번이라도 마감을 쓴 매장만 본다(아직 앱을 안 쓰는 매장은 제외).
        for (const s of storeRows ?? []) {
          const last = lastByStore.get(s.id);
          const d = daysSince(last);
          if (last && d !== null && d >= 3) warnings.push(`${s.name} 마감입력 ${d}일째 없음 (마지막 ${last})`);
        }
      } catch (e) {
        warnings.push(`매장별 마감 점검 실패: ${errMsg(e)}`);
      }
    }

    // 3-1) 구글 Places 실제 조회 — 리뷰 수집(collect-reviews)이 쓰는 것과 같은 요청을 매장 한 곳에 보내
    //      키·결제·API 사용 설정 문제를 바로 드러낸다(2026-10-21부터 조용히 실패했던 원인 추적용).
    //      하루 두 번(아침 루틴·점심 pg_cron) 한 건이라 비용은 무시할 수준.
    const placesKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!placesKey) {
      warnings.push("GOOGLE_PLACES_API_KEY 없음 — 리뷰 수집 불가");
      info.googlePlaces = "키 없음";
    } else {
      try {
        const { data: sample } = await withTimeout(
          supabase.from("stores").select("name, google_place_id").not("google_place_id", "is", null).limit(1),
          DB_TIMEOUT_MS,
          "place_id 조회"
        );
        const target = sample?.[0];
        if (!target?.google_place_id) {
          info.googlePlaces = "place_id 있는 매장 없음";
        } else {
          const r = await withTimeout(
            fetchGooglePlaceSnapshot(target.google_place_id, placesKey),
            DB_TIMEOUT_MS,
            "구글 Places"
          );
          if (r.ok) {
            info.googlePlaces = `정상 (${target.name} 평점 ${r.snapshot.rating}, 리뷰 ${r.snapshot.reviewCount}건)`;
          } else {
            info.googlePlaces = r.error;
            problems.push(`구글 Places 조회 실패 (${r.error}) — 리뷰 수집이 멈춤`);
          }
        }
      } catch (e) {
        problems.push(`구글 Places 조회 실패: ${errMsg(e)}`);
      }
    }
  }

  // 4) 푸시 설정
  const push = await webPushStatus();
  const vapidOk = push.ok;
  if (!vapidOk) problems.push(`웹푸시 설정 오류 (${push.reason}) — 알림이 전혀 안 나감`);

  // 5) 대표 계정 푸시 구독 (알림 수신처)
  let ownerSubs: { id: string; endpoint: string; p256dh: string; auth: string }[] = [];
  if (!dbError) {
    try {
      const { data: owners } = await withTimeout(
        supabase.from("profiles").select("id").eq("role", "owner"),
        DB_TIMEOUT_MS,
        "owner 조회"
      );
      const ownerIds = (owners ?? []).map((o) => o.id);
      if (ownerIds.length > 0) {
        const { data } = await withTimeout(
          supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ownerIds),
          DB_TIMEOUT_MS,
          "owner 구독 조회"
        );
        ownerSubs = data ?? [];
      }
      info.ownerSubscriptions = ownerSubs.length;
      if (ownerSubs.length === 0) problems.push("대표 계정의 푸시 구독이 없음 — 앱에서 '알림 받기'를 눌러야 알림을 받음");
    } catch (e) {
      warnings.push(`대표 구독 조회 실패: ${errMsg(e)}`);
    }
  }

  const ok = problems.length === 0;
  const shouldNotify = notify === "always" || (notify === "problems" && !ok);
  let notified = 0;

  if (shouldNotify && vapidOk && ownerSubs.length > 0) {
    const title = ok ? `[${env}] 앱 점검 정상` : `[${env}] 앱 점검 이상 ${problems.length}건`;
    const body = summary
      ? summary
      : ok
      ? warnings.length > 0
        ? `경고 ${warnings.length}건: ${warnings.slice(0, 2).join(" / ")}`
        : `핵심 화면·DB·크론·푸시 모두 정상 (DB ${dbMs}ms)`
      : problems.slice(0, 3).join(" / ");
    const expiredIds: string[] = [];
    await Promise.all(
      ownerSubs.map(async (s) => {
        const { expired, sent } = await sendPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          { title, body: body.slice(0, 180), url: "/" }
        );
        if (expired) expiredIds.push(s.id);
        else if (sent) notified++;
      })
    );
    if (expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }
  }

  const result = {
    ok,
    env,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    problems,
    warnings,
    info,
    notified,
  };
  console.log(`[health] ${env} ok=${ok} problems=${problems.length} warnings=${warnings.length} notified=${notified}`);
  return NextResponse.json(result, { status: ok ? 200 : 503 });
}
