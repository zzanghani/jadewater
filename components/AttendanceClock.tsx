"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordAttendance, type AttendanceInput } from "@/app/(app)/attendance/actions";
import {
  BLOCK_REASON_LABEL,
  distanceMeters,
  evaluateAttendance,
  type AttendanceBlockReason,
} from "@/lib/geoAttendance";
import type { AttendanceRecord, AttendanceType, StoreLocation } from "@/lib/types";

const QUEUE_KEY = "attendance_queue_v1";

type Position = { lat: number; lng: number; accuracy: number; at: number };

function readQueue(): AttendanceInput[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AttendanceInput[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: AttendanceInput[]) {
  try {
    if (items.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // 저장 공간이 막혀 있어도 화면은 동작해야 한다.
  }
}

function newRecordId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function timeLabel(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function clockLabel(d: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export default function AttendanceClock({
  storeName,
  location,
  todayRecords,
}: {
  storeName: string;
  location: StoreLocation | null;
  todayRecords: AttendanceRecord[];
}) {
  const router = useRouter();
  const [pos, setPos] = useState<Position | null>(null);
  const [geoError, setGeoError] = useState<AttendanceBlockReason | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [queued, setQueued] = useState(0);
  const [toast, setToast] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState<AttendanceType | null>(null);
  const flushing = useRef(false);

  // 시계는 마운트 뒤에만 돌린다 (서버 렌더와 어긋나지 않게).
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 고정밀 모드, 타임아웃 15초. watchPosition이라 갱신은 OS가 알아서 밀어준다.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGeoError(null);
        setPos({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: Math.round(p.coords.accuracy),
          at: Date.now(),
        });
      },
      (err) => {
        setGeoError(err.code === err.PERMISSION_DENIED ? "no_permission" : "no_location");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const showToast = useCallback((kind: "ok" | "warn" | "error", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // 큐에 쌓인 기록을 순서대로 서버에 보낸다. 네트워크 실패(throw)는 큐에
  // 남기고, 서버가 거절한(ok=false) 건은 큐에서 빼고 사유를 보여준다.
  const flushQueue = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      let items = readQueue();
      setQueued(items.length);
      let changed = false;
      for (const item of [...items]) {
        try {
          const res = await recordAttendance(item);
          items = items.filter((i) => i.client_record_id !== item.client_record_id);
          writeQueue(items);
          setQueued(items.length);
          changed = true;
          if (!res.ok) {
            showToast("error", res.error);
          } else if (res.duplicate) {
            // 이미 저장된 기록 — 조용히 넘어간다.
          } else if (res.flagged) {
            showToast(
              "warn",
              `${item.type === "IN" ? "출근" : "퇴근"} 기록됨 (매장에서 ${res.distance_m}m — 관리자 확인 표시)`
            );
          } else {
            showToast("ok", `${item.type === "IN" ? "출근" : "퇴근"} 기록 완료 (매장에서 ${res.distance_m}m)`);
          }
        } catch {
          // 오프라인 등 — 다음 기회에 다시 보낸다.
          break;
        }
      }
      if (changed) router.refresh();
    } finally {
      flushing.current = false;
    }
  }, [router, showToast]);

  useEffect(() => {
    void flushQueue();
    const onOnline = () => void flushQueue();
    const onVisible = () => {
      if (document.visibilityState === "visible") void flushQueue();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flushQueue]);

  const distance =
    pos && location ? Math.round(distanceMeters(pos.lat, pos.lng, location.lat, location.lng)) : null;
  const verdict =
    pos && location && distance !== null
      ? evaluateAttendance({ distanceM: distance, accuracyM: pos.accuracy, radiusM: location.radius_m })
      : { inRange: false, reason: (geoError ?? "no_location") as AttendanceBlockReason };
  const reason: AttendanceBlockReason | null = !location ? null : geoError ?? verdict.reason;
  const canRecord = !!location && !!pos && verdict.inRange && !submitting;

  const last = todayRecords[todayRecords.length - 1] ?? null;
  const nextType: AttendanceType = last?.type === "IN" ? "OUT" : "IN";

  async function handleRecord(type: AttendanceType) {
    if (!pos || !canRecord) return;
    setSubmitting(type);
    const item: AttendanceInput = {
      client_record_id: newRecordId(),
      type,
      recorded_at: new Date().toISOString(),
      lat: pos.lat,
      lng: pos.lng,
      accuracy_m: pos.accuracy,
      device_info: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : undefined,
    };
    // 먼저 큐에 넣고 보내야 전송 중 앱이 닫혀도 기록이 안 사라진다.
    const items = [...readQueue(), item];
    writeQueue(items);
    setQueued(items.length);
    try {
      await flushQueue();
      if (readQueue().some((i) => i.client_record_id === item.client_record_id)) {
        showToast("warn", "지금은 전송이 안 돼서 기기에 저장해 뒀어요. 연결되면 자동으로 보내요.");
      }
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 상태 카드: 거리 · 반경 · 오차 */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold">{storeName}</span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              !location
                ? "bg-gray-100 text-gray-500"
                : canRecord || (verdict.inRange && !!pos)
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
            }`}
          >
            {!location ? "매장 위치 미설정" : pos && verdict.inRange ? "매장 안" : "기록 불가"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="매장까지" value={distance === null ? "—" : `${distance}m`} />
          <Stat label="허용 반경" value={location ? `${location.radius_m}m` : "—"} />
          <Stat label="GPS 오차" value={pos ? `±${pos.accuracy}m` : "—"} />
        </div>
        {!location ? (
          <p className="mt-3 text-xs text-muted">
            매장 좌표가 아직 없어요. 지점장님이 &lsquo;매장 위치 설정&rsquo;에서 한 번만 잡아주면 됩니다.
          </p>
        ) : reason ? (
          <p className="mt-3 text-xs font-medium text-red-600">{BLOCK_REASON_LABEL[reason]}</p>
        ) : (
          <p className="mt-3 text-xs text-muted">매장 반경 안이에요. 버튼을 눌러 기록하세요.</p>
        )}
      </section>

      {/* 시계 */}
      <div className="text-center">
        <p className="font-mono text-4xl font-bold tabular-nums">{now ? clockLabel(now) : "--:--:--"}</p>
      </div>

      {/* 출근 / 퇴근 */}
      <div className="grid grid-cols-2 gap-3">
        <RecordButton
          label="출근"
          primary={nextType === "IN"}
          disabled={!canRecord}
          pending={submitting === "IN"}
          onClick={() => handleRecord("IN")}
        />
        <RecordButton
          label="퇴근"
          primary={nextType === "OUT"}
          disabled={!canRecord}
          pending={submitting === "OUT"}
          onClick={() => handleRecord("OUT")}
        />
      </div>

      {queued > 0 && (
        <p className="text-center text-xs font-medium text-amber-600">
          전송 대기 {queued}건 — 연결되면 자동으로 보내요.
        </p>
      )}

      {/* 오늘 기록 */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">오늘 기록</h2>
        {todayRecords.length === 0 ? (
          <p className="text-xs text-muted">아직 기록이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {todayRecords.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <span className="font-semibold">
                  {r.type === "IN" ? "출근" : "퇴근"}
                  {r.flagged && (
                    <span className="ml-1.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      반경 밖
                    </span>
                  )}
                </span>
                <span className="text-muted">
                  {timeLabel(r.recorded_at)} · {r.distance_m}m
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {toast && (
        <div
          className={`fixed inset-x-4 bottom-24 z-50 rounded-xl px-4 py-3 text-center text-sm font-semibold text-white shadow-lg ${
            toast.kind === "ok" ? "bg-green-600" : toast.kind === "warn" ? "bg-amber-500" : "bg-red-600"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background px-2 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

function RecordButton({
  label,
  primary,
  disabled,
  pending,
  onClick,
}: {
  label: string;
  primary: boolean;
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl py-5 text-lg font-bold transition-opacity disabled:opacity-40 ${
        primary
          ? "bg-brand text-white shadow-md shadow-brand/30"
          : "border border-brand bg-brand/10 text-brand"
      }`}
    >
      {pending ? "기록 중..." : label}
    </button>
  );
}
