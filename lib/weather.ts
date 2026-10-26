// 서울 일별 날씨 (open-meteo: 키 없이 무료). 매장이 모두 서울·하남이라 한 지점으로 쓴다.
// 지난 날은 archive, 최근 1주는 forecast(past_days)에서 받는다 (archive는 며칠 늦게 채워짐).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { addYmd } from "@/lib/adReport";

const LAT = 37.55;
const LNG = 126.98;
const DAILY = "precipitation_sum,temperature_2m_max,temperature_2m_min";

export type WeatherDay = { date: string; precip_mm: number; tmax: number | null; tmin: number | null };

type OpenMeteo = { daily?: { time: string[]; precipitation_sum: (number | null)[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[] } };

async function fetchRange(url: string): Promise<WeatherDay[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(25000), cache: "no-store" });
  if (!res.ok) throw new Error(`날씨 조회 실패 (${res.status})`);
  const j = (await res.json()) as OpenMeteo;
  const d = j.daily;
  if (!d) return [];
  return d.time.map((t, i) => ({ date: t, precip_mm: d.precipitation_sum[i] ?? 0, tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i] }));
}

/** from~to 날씨를 받아 weather_daily에 넣는다. 이미 있는 날은 최근 7일만 다시 받는다. */
export async function syncWeather(service: SupabaseClient<Database>, from: string, to: string): Promise<number> {
  const { data: have } = await service.from("weather_daily").select("date").gte("date", from).lte("date", to);
  const haveSet = new Set((have ?? []).map((r) => r.date));
  const recentFrom = addYmd(to, -7);
  const needOld: string[] = [];
  for (let d = from; d < recentFrom; d = addYmd(d, 1)) if (!haveSet.has(d)) needOld.push(d);
  const rows: WeatherDay[] = [];
  if (needOld.length) {
    const a = needOld[0];
    const z = needOld[needOld.length - 1];
    rows.push(...(await fetchRange(`https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LNG}&start_date=${a}&end_date=${z}&daily=${DAILY}&timezone=Asia%2FSeoul`)));
  }
  rows.push(...(await fetchRange(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&daily=${DAILY}&past_days=8&forecast_days=1&timezone=Asia%2FSeoul`)));
  const upserts = rows
    .filter((r) => r.date >= from && r.date <= to)
    .map((r) => ({ ...r, precip_mm: Number(r.precip_mm ?? 0), synced_at: new Date().toISOString() }));
  if (upserts.length) {
    const { error } = await service.from("weather_daily").upsert(upserts, { onConflict: "date" });
    if (error) throw new Error(`날씨 저장 실패: ${error.message}`);
  }
  return upserts.length;
}

/** 비 온 날 기준: 1mm 이상. 5mm 이상이면 매출 비교에서 뺀다. */
export const RAIN_MM = 1;
export const HEAVY_RAIN_MM = 5;
