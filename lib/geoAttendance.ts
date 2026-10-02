// GPS 출퇴근 판정 규칙 (사양서 4장). 클라이언트(버튼 활성화 UX)와 서버(최종
// 재검증)가 같은 함수를 쓰므로 둘의 결과가 어긋나면 그건 좌표 차이지 규칙
// 차이가 아니다.

/** 지구 반경(m) — Haversine 공식에 쓰는 값. */
const EARTH_RADIUS_M = 6_371_000;
/** 이 값보다 GPS 오차가 크면 판정을 보류하고 버튼을 잠근다. */
export const MAX_ACCURACY_M = 100;
/** 허용 반경 최소값. 그 이하로 입력하면 이 값으로 보정한다. */
export const MIN_RADIUS_M = 10;
export const DEFAULT_RADIUS_M = 50;

export type AttendanceBlockReason =
  | "no_permission"
  | "no_location"
  | "low_accuracy"
  | "out_of_range";

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function clampRadius(radius: number): number {
  return Number.isFinite(radius) && radius > MIN_RADIUS_M ? Math.round(radius) : MIN_RADIUS_M;
}

/**
 * 반경 안 판정: distance − accuracy ≤ radius.
 * 실외 GPS 오차 5~15m, 실내 20~100m라 명목 반경만 보면 매장 안에서도 버튼이
 * 잠기는 오탐이 난다. 오차만큼 여유를 주되 100m 초과 오차는 아예 보류한다.
 */
export function evaluateAttendance(input: {
  distanceM: number;
  accuracyM: number;
  radiusM: number;
}): { inRange: boolean; reason: AttendanceBlockReason | null } {
  if (input.accuracyM > MAX_ACCURACY_M) return { inRange: false, reason: "low_accuracy" };
  const ok = input.distanceM - input.accuracyM <= clampRadius(input.radiusM);
  return { inRange: ok, reason: ok ? null : "out_of_range" };
}

export const BLOCK_REASON_LABEL: Record<AttendanceBlockReason, string> = {
  no_permission: "위치 권한이 꺼져 있어요. 설정에서 이 앱의 위치 접근을 허용해 주세요.",
  no_location: "위치를 아직 못 잡았어요. 잠시만 기다려 주세요.",
  low_accuracy: "GPS 정확도가 낮아요(±100m 초과). 창가나 실외로 잠깐 이동해 보세요.",
  out_of_range: "매장 반경 밖이에요. 매장 안에서 다시 눌러 주세요.",
};
