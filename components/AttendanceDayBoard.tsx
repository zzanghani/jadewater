import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kstDateString, kstShortDateLabel, kstWeekdayShortLabel, shiftDateString } from "@/lib/date";
import {
  kstDateAndMinutes,
  nameMatches,
  normalizeName,
  scheduleVerdict,
  timeToMinutes,
  verdictLabel,
} from "@/lib/attendanceSchedule";
import { resolveAttendanceNames } from "@/lib/attendanceNames";
import type { Database } from "@/lib/types";

// 시각 "HH:MM:SS" → "HH:MM"
function hm(t: string) {
  return t.slice(0, 5);
}

function kstTime(iso: string) {
  const { minutes } = kstDateAndMinutes(iso);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

type Status =
  | { kind: "before" } // 출근 시각 전
  | { kind: "absent" } // 출근 시각 지났는데 안 찍음
  | { kind: "in"; time: string; late: number | null; flagged: boolean }
  | { kind: "out"; inTime: string; outTime: string; late: number | null; early: number | null; flagged: boolean };

/**
 * 지점장·마스터용 "그날 출근 현황" — 스케줄러에 잡힌 사람 전원을 보여주고
 * 각자 출근했는지, 몇 분 지각인지, 아직 안 왔는지(미출근)를 한눈에 본다.
 * 스케줄 이름 ↔ 계정 이름(공백 무시)으로 맞춘다.
 */
export default async function AttendanceDayBoard({
  supabase,
  storeId,
  date,
  basePath = "/attendance",
}: {
  supabase: SupabaseClient<Database>;
  storeId: string;
  date: string;
  basePath?: string;
}) {
  const today = kstDateString(0);
  const start = new Date(`${date}T00:00:00+09:00`).toISOString();
  const end = new Date(new Date(start).getTime() + 86_400_000).toISOString();

  const [{ data: shifts }, { data: records }] = await Promise.all([
    supabase
      .from("schedule_shifts")
      .select("id, role, employee_name, start_time, end_time")
      .eq("store_id", storeId)
      .eq("date", date)
      .order("start_time"),
    supabase
      .from("attendance_records")
      .select("user_id, type, recorded_at, diff_minutes, flagged")
      .eq("store_id", storeId)
      .gte("recorded_at", start)
      .lt("recorded_at", end)
      .order("recorded_at"),
  ]);

  const userIds = Array.from(new Set((records ?? []).map((r) => r.user_id)));
  const resolved = await resolveAttendanceNames(supabase, storeId, userIds);

  // 이름(키)별 첫 출근·마지막 퇴근. 한 계정이 여러 이름 키를 가질 수 있어
  // (지점장 계정 = 매장명 + 직원 리스트의 점장 이름) 키마다 같은 기록을 건다.
  const firstIn = new Map<string, { time: string; late: number | null; flagged: boolean }>();
  const lastOut = new Map<string, { time: string; early: number | null; flagged: boolean }>();
  const displayByKey = new Map<string, string>();
  for (const r of records ?? []) {
    const who = resolved.get(r.user_id);
    if (!who) continue;
    for (const key of who.keys) {
      displayByKey.set(key, who.display);
      if (r.type === "IN") {
        if (!firstIn.has(key)) {
          firstIn.set(key, { time: kstTime(r.recorded_at), late: r.diff_minutes, flagged: r.flagged });
        }
      } else {
        lastOut.set(key, {
          time: kstTime(r.recorded_at),
          early: r.diff_minutes === null ? null : -r.diff_minutes,
          flagged: r.flagged,
        });
      }
    }
  }

  const nowMinutes = kstDateAndMinutes(new Date().toISOString()).minutes;
  const isPastDay = date < today;
  const isFuture = date > today;

  // 스케줄 이름과 "같은 사람"인 키를 찾는다 (정확히 같은 것 우선, 없으면 포함 관계).
  function findKey<T>(map: Map<string, T>, shiftName: string): T | undefined {
    const exact = map.get(normalizeName(shiftName));
    if (exact) return exact;
    for (const [k, v] of map) if (nameMatches(k, shiftName)) return v;
    return undefined;
  }

  const rows = (shifts ?? []).map((s) => {
    const inRec = findKey(firstIn, s.employee_name);
    const outRec = findKey(lastOut, s.employee_name);
    let status: Status;
    if (inRec && outRec) {
      status = {
        kind: "out",
        inTime: inRec.time,
        outTime: outRec.time,
        late: inRec.late,
        early: outRec.early,
        flagged: inRec.flagged || outRec.flagged,
      };
    } else if (inRec) {
      status = { kind: "in", time: inRec.time, late: inRec.late, flagged: inRec.flagged };
    } else if (isFuture || (!isPastDay && nowMinutes <= timeToMinutes(s.start_time))) {
      status = { kind: "before" };
    } else {
      status = { kind: "absent" };
    }
    return { shift: s, status };
  });

  // 스케줄엔 없는데 출근을 찍은 사람(지원 근무 등)도 아래 따로 보여준다.
  // 한 계정의 여러 이름 키 중 하나라도 스케줄에 맞으면 "스케줄 없음"이 아니다.
  const scheduledNames = rows.map((r) => r.shift.employee_name);
  const seenDisplay = new Set<string>();
  const extras: { name: string; rec: { time: string }; out?: { time: string } }[] = [];
  for (const [, who] of resolved) {
    const keys = Array.from(who.keys);
    if (keys.some((k) => scheduledNames.some((n) => nameMatches(k, n)))) continue;
    const key = keys.find((k) => firstIn.has(k));
    if (!key || seenDisplay.has(who.display)) continue;
    seenDisplay.add(who.display);
    extras.push({ name: who.display, rec: firstIn.get(key)!, out: lastOut.get(key) });
  }

  const total = rows.length;
  const arrived = rows.filter((r) => r.status.kind === "in" || r.status.kind === "out").length;
  const absent = rows.filter((r) => r.status.kind === "absent").length;
  const late = rows.filter(
    (r) => (r.status.kind === "in" || r.status.kind === "out") && (r.status.late ?? 0) > 0
  ).length;

  const prev = shiftDateString(date, -1);
  const next = shiftDateString(date, 1);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <Link href={`${basePath}?date=${prev}`} className="px-2 text-sm font-semibold text-muted" aria-label="전날">
          ‹
        </Link>
        <h2 className="text-sm font-bold">
          {kstShortDateLabel(date)} ({kstWeekdayShortLabel(date)}) 출근 현황
          {date === today && <span className="ml-1 text-xs font-normal text-muted">오늘</span>}
        </h2>
        {date < today ? (
          <Link href={`${basePath}?date=${next}`} className="px-2 text-sm font-semibold text-muted" aria-label="다음날">
            ›
          </Link>
        ) : (
          <span className="px-2 text-sm text-transparent">›</span>
        )}
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted">이 날은 스케줄러에 등록된 근무가 없어요.</p>
      ) : (
        <>
          <div className="mb-3 flex gap-2 text-center text-xs">
            <Summary label="예정" value={total} />
            <Summary label="출근" value={arrived} tone="green" />
            <Summary label="지각" value={late} tone={late > 0 ? "red" : undefined} />
            <Summary label={isPastDay ? "결근" : "미출근"} value={absent} tone={absent > 0 ? "red" : undefined} />
          </div>

          <ul className="flex flex-col gap-2">
            {rows.map(({ shift, status }) => (
              <li key={shift.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{shift.employee_name}</span>
                  <span className="ml-1.5 text-[11px] text-muted">
                    {shift.role} · {hm(shift.start_time)}~{hm(shift.end_time)}
                  </span>
                </span>
                <StatusBadge status={status} isPastDay={isPastDay} />
              </li>
            ))}
          </ul>
        </>
      )}

      {extras.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="mb-1.5 text-[11px] font-semibold text-muted">스케줄에 없는 출근</p>
          <ul className="flex flex-col gap-1.5">
            {extras.map(({ name, rec, out }) => (
              <li key={name} className="flex items-center justify-between text-sm">
                <span className="font-semibold">{displayByKey.get(normalizeName(name)) ?? name}</span>
                <span className="text-xs text-muted tabular-nums">
                  출근 {rec.time}
                  {out && ` · 퇴근 ${out.time}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone?: "green" | "red" }) {
  const color = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-600" : "text-foreground";
  return (
    <div className="flex-1 rounded-xl bg-background px-2 py-1.5">
      <p className="text-[10px] text-muted">{label}</p>
      <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status, isPastDay }: { status: Status; isPastDay: boolean }) {
  if (status.kind === "before") {
    return <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">출근 전</span>;
  }
  if (status.kind === "absent") {
    return (
      <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
        {isPastDay ? "결근" : "미출근"}
      </span>
    );
  }
  const lateV = scheduleVerdict("IN", status.late);
  const isLate = lateV.kind === "late";
  if (status.kind === "in") {
    return (
      <span className="shrink-0 text-right text-xs tabular-nums">
        <span className={`font-bold ${isLate ? "text-red-600" : "text-green-700"}`}>
          {isLate ? verdictLabel(lateV) : "출근"}
        </span>
        <span className="ml-1 text-muted">{status.time}</span>
        {status.flagged && <span className="ml-1 text-[10px] text-amber-700">반경밖</span>}
      </span>
    );
  }
  const earlyV = scheduleVerdict("OUT", status.early === null ? null : -status.early);
  const isEarly = earlyV.kind === "early_leave";
  return (
    <span className="shrink-0 text-right text-xs tabular-nums">
      <span className={`font-bold ${isLate ? "text-red-600" : "text-green-700"}`}>
        {isLate ? verdictLabel(lateV) : "출근"}
      </span>
      <span className="ml-1 text-muted">{status.inTime}</span>
      <br />
      <span className={`font-bold ${isEarly ? "text-red-600" : "text-blue-700"}`}>
        {isEarly ? verdictLabel(earlyV) : "퇴근"}
      </span>
      <span className="ml-1 text-muted">{status.outTime}</span>
      {status.flagged && <span className="ml-1 text-[10px] text-amber-700">반경밖</span>}
    </span>
  );
}
