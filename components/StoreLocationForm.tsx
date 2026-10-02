"use client";

import { useActionState, useState } from "react";
import { saveStoreLocation } from "@/app/(app)/attendance/actions";
import { DEFAULT_RADIUS_M, MIN_RADIUS_M } from "@/lib/geoAttendance";
import type { StoreLocation } from "@/lib/types";

export default function StoreLocationForm({
  storeId,
  storeName,
  location,
}: {
  storeId: string;
  storeName: string;
  location: StoreLocation | null;
}) {
  const [state, formAction, pending] = useActionState(saveStoreLocation, undefined);
  const [lat, setLat] = useState(location ? String(location.lat) : "");
  const [lng, setLng] = useState(location ? String(location.lng) : "");
  const [radius, setRadius] = useState(String(location?.radius_m ?? DEFAULT_RADIUS_M));
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [locateAccuracy, setLocateAccuracy] = useState<number | null>(null);

  // 지점장이 매장 입구에 서서 한 번 누르면 좌표가 들어간다 — 카카오맵 좌표를
  // 손으로 옮길 필요가 없다. 오차가 크면 그대로 저장하지 말라고 알려준다.
  function useCurrentPosition() {
    if (!navigator.geolocation) {
      setLocateError("이 기기에서는 위치를 가져올 수 없어요.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
        setLocateAccuracy(Math.round(p.coords.accuracy));
        setLocating(false);
      },
      (err) => {
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? "위치 권한이 꺼져 있어요. 설정에서 허용해 주세요."
            : "위치를 가져오지 못했어요. 잠시 후 다시 시도해 주세요."
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum) && lat !== "" && lng !== "";
  const mapHref = hasCoords
    ? `https://map.kakao.com/link/map/${encodeURIComponent(storeName)},${latNum},${lngNum}`
    : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="store_id" value={storeId} />

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold">{storeName}</span>
          {location && (
            <span className="text-[11px] text-muted">
              마지막 저장 {new Date(location.updated_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={useCurrentPosition}
          disabled={locating}
          className="rounded-xl border border-brand bg-brand/10 py-3 text-sm font-semibold text-brand disabled:opacity-50"
        >
          {locating ? "위치 잡는 중..." : "📍 지금 서 있는 곳을 매장 위치로"}
        </button>
        {locateAccuracy !== null && (
          <p className={`text-xs ${locateAccuracy > 30 ? "font-medium text-amber-600" : "text-muted"}`}>
            현재 GPS 오차 ±{locateAccuracy}m
            {locateAccuracy > 30 && " — 오차가 커요. 매장 입구(실외)에서 다시 잡는 게 좋아요."}
          </p>
        )}
        {locateError && <p className="text-xs font-medium text-red-600">{locateError}</p>}

        <label className="flex flex-col gap-1 text-xs text-muted">
          위도 (lat)
          <input
            name="lat"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            inputMode="decimal"
            placeholder="37.541731"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          경도 (lng)
          <input
            name="lng"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            inputMode="decimal"
            placeholder="127.061553"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          허용 반경 (m) · 최소 {MIN_RADIUS_M}m
          <input
            name="radius_m"
            value={radius}
            onChange={(e) => setRadius(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          주소 (메모용)
          <input
            name="address"
            defaultValue={location?.address ?? ""}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        {mapHref && (
          <a
            href={mapHref}
            target="_blank"
            rel="noreferrer"
            className="text-center text-xs font-semibold text-brand underline"
          >
            카카오맵에서 이 좌표 확인하기
          </a>
        )}
      </div>

      {state?.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm font-medium text-green-700">저장했어요.</p>}

      <button
        type="submit"
        disabled={pending || !hasCoords}
        className="rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 disabled:opacity-50"
      >
        {pending ? "저장 중..." : "매장 위치 저장"}
      </button>
    </form>
  );
}
