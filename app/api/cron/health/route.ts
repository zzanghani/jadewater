import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPush } from "@/lib/webpush";

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
      const [stores, profiles, closings, attendance, subs] = await withTimeout(
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
      info.lastClosing = lastClosing;
      info.lastAttendance = lastAttendance;
      // 운영(블루)에서만 "입력이 끊겼다"를 경고한다. 그린은 시험 데이터라 비어 있어도 정상.
      if (env === "블루") {
        const cd = daysSince(lastClosing);
        if (cd !== null && cd >= 3) warnings.push(`마감입력이 ${cd}일째 없음 (마지막 ${lastClosing})`);
        const ad = daysSince(lastAttendance);
        if (ad !== null && ad >= 3) warnings.push(`출퇴근 기록이 ${ad}일째 없음`);
      }
    } catch (e) {
      problems.push(`핵심 테이블 점검 실패: ${errMsg(e)}`);
    }
  }

  // 4) 푸시 설정
  const vapidOk = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (!vapidOk) problems.push("웹푸시 VAPID 환경변수 없음 — 알림이 전혀 안 나감");

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
        const { expired } = await sendPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          { title, body: body.slice(0, 180), url: "/" }
        );
        if (expired) expiredIds.push(s.id);
        else notified++;
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
