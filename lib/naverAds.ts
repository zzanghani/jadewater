// 네이버 검색광고 API (서버 전용). 키는 DB(store_ad_accounts)에만 있고 브라우저로 안 나간다.
// 서명 = base64(HMAC-SHA256(secret, "{timestamp}.{METHOD}.{path}")) — path에는 쿼리스트링을 넣지 않는다.
import crypto from "node:crypto";

const BASE = "https://api.searchad.naver.com";
export const STAT_FIELDS = JSON.stringify(["impCnt", "clkCnt", "salesAmt", "ccnt", "avgRnk"]);

export type NaverAcct = { customerId: string; apiKey: string; secretKey: string };
export type NaverStatRow = {
  id: string;
  impCnt?: number;
  clkCnt?: number;
  salesAmt?: number;
  ccnt?: number;
  avgRnk?: number;
  dateStart?: string;
};

function sign(timestamp: string, method: string, path: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${method}.${path}`).digest("base64");
}

export class NaverApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function callNaver<T = unknown>(
  acct: NaverAcct,
  path: string,
  query: Record<string, string | number | undefined> = {}
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") qs.append(k, String(v));
  const url = BASE + path + (qs.toString() ? `?${qs}` : "");
  const ts = String(Date.now());
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Timestamp": ts,
        "X-API-KEY": acct.apiKey,
        "X-Customer": acct.customerId,
        "X-Signature": sign(ts, "GET", path, acct.secretKey),
      },
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    });
  } catch (e) {
    const err = e as Error;
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new NaverApiError("네이버 응답이 9초 넘게 없습니다. 잠시 후 다시 시도해 주세요.", 0);
    }
    throw new NaverApiError(err.message, 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (res.status >= 400) {
    const d = (data ?? {}) as { title?: string; message?: string; raw?: string };
    throw new NaverApiError(d.title || d.message || d.raw || `네이버 API 오류 (${res.status})`, res.status);
  }
  return data as T;
}

/** 키가 맞는지 확인하는 가장 가벼운 호출 — 비즈머니 잔액. */
export async function testNaverAccount(acct: NaverAcct): Promise<{ ok: true; bizmoney: number | null } | { ok: false; error: string }> {
  try {
    const r = await callNaver<{ bizmoney?: number }>(acct, "/billing/bizmoney");
    return { ok: true, bizmoney: r?.bizmoney ?? null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 여러 id의 기간 합계를 50개씩 끊어 받는다. */
export async function statsMap(
  acct: NaverAcct,
  ids: string[],
  since: string,
  until: string
): Promise<Record<string, NaverStatRow>> {
  const out: Record<string, NaverStatRow> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const d = await callNaver<{ data?: NaverStatRow[] }>(acct, "/stats", {
      ids: ids.slice(i, i + 50).join(","),
      fields: STAT_FIELDS,
      timeRange: JSON.stringify({ since, until }),
    });
    for (const row of d?.data ?? []) out[row.id] = row;
  }
  return out;
}

/** 동시 실행 개수를 제한한 map. 네이버 호출이 많아서(매장당 수십 회) 필요하다. */
export async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    })
  );
  return out;
}

/* ---------- 캠페인 읽기·쓰기 (3순위: 앱에서 켜고 끄기·하루 예산) ---------- */
export type NaverCampaign = {
  nccCampaignId: string;
  name: string;
  campaignTp?: string; // WEB_SITE(파워링크) | PLACE(플레이스) ...
  status?: string; // ELIGIBLE | PAUSED | DELETED ...
  statusReason?: string;
  userLock?: boolean; // true = 꺼짐(사용자 중지)
  dailyBudget?: number;
  useDailyBudget?: boolean;
};

export const CAMPAIGN_TP_LABEL: Record<string, string> = {
  WEB_SITE: "파워링크",
  PLACE: "플레이스",
  SHOPPING: "쇼핑",
  POWER_CONTENTS: "파워컨텐츠",
  BRAND_SEARCH: "브랜드검색",
};

/** 쓰기 호출. 서명은 GET과 같은 규칙에 메서드만 바뀐다. 쿼리스트링은 서명에 안 들어간다. */
export async function callNaverWrite<T = unknown>(
  acct: NaverAcct,
  method: "PUT" | "POST" | "DELETE",
  path: string,
  body: unknown,
  query: Record<string, string | undefined> = {}
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") qs.append(k, v);
  const url = BASE + path + (qs.toString() ? `?${qs}` : "");
  const ts = String(Date.now());
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Timestamp": ts,
        "X-API-KEY": acct.apiKey,
        "X-Customer": acct.customerId,
        "X-Signature": sign(ts, method, path, acct.secretKey),
      },
      body: body == null ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    });
  } catch (e) {
    const err = e as Error;
    if (err.name === "TimeoutError" || err.name === "AbortError") throw new NaverApiError("네이버 응답이 9초 넘게 없습니다. 잠시 후 다시 시도해 주세요.", 0);
    throw new NaverApiError(err.message, 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (res.status >= 400) {
    const d = (data ?? {}) as { title?: string; message?: string; raw?: string };
    throw new NaverApiError(d.title || d.message || d.raw || `네이버 API 오류 (${res.status})`, res.status);
  }
  return data as T;
}

export async function listCampaigns(acct: NaverAcct): Promise<NaverCampaign[]> {
  const rows = (await callNaver<NaverCampaign[]>(acct, "/ncc/campaigns")) ?? [];
  return rows.filter((c) => c.status !== "DELETED");
}

/** 캠페인 켜기/끄기. userLock=true 가 '꺼짐'. */
export async function setCampaignLock(acct: NaverAcct, campaignId: string, lock: boolean): Promise<NaverCampaign> {
  return callNaverWrite<NaverCampaign>(acct, "PUT", `/ncc/campaigns/${campaignId}`, { nccCampaignId: campaignId, userLock: lock }, { fields: "userLock" });
}

/** 하루 예산(원). 0이면 예산 제한 없음. 네이버는 10원 단위만 받는다. */
export async function setCampaignBudget(acct: NaverAcct, campaignId: string, dailyBudget: number): Promise<NaverCampaign> {
  const budget = Math.max(0, Math.round(dailyBudget / 10) * 10);
  return callNaverWrite<NaverCampaign>(
    acct,
    "PUT",
    `/ncc/campaigns/${campaignId}`,
    { nccCampaignId: campaignId, dailyBudget: budget, useDailyBudget: budget > 0 },
    { fields: "budget" }
  );
}

/* ---------- 광고그룹 노출 시간 (요일×시간) ---------- */
export type NaverTarget = { nccTargetId?: string; ownerId?: string; targetTp?: string; target?: unknown };
export type NaverAdgroup = {
  nccAdgroupId: string;
  nccCampaignId: string;
  name: string;
  status?: string;
  userLock?: boolean;
  targets?: NaverTarget[];
};
export type WeekSchedule = Record<number, number[]>; // 0=일 … 6=토 → 켜진 시간(0~23)

/** 네이버 요일 키(1=월 … 7=일)와 우리 요일(0=일 … 6=토) 변환 */
const toNaverDay = (d: number) => (d === 0 ? 7 : d);
const fromNaverDay = (k: string | number) => {
  const n = Number(k);
  return n === 7 ? 0 : n;
};

/** 광고그룹의 TIME_WEEKLY_TARGET를 우리 형식으로. 타겟이 없거나 비어 있으면 '항상 노출'(null). */
export function parseTimeTarget(targets: NaverTarget[] | undefined): WeekSchedule | null {
  const t = (targets ?? []).find((x) => x.targetTp === "TIME_WEEKLY_TARGET");
  const raw = t?.target as Record<string, unknown> | null | undefined;
  if (!raw || typeof raw !== "object") return null;
  const out: WeekSchedule = {};
  let any = false;
  for (const [k0, v] of Object.entries(raw)) {
    const k = /^[1-7]$/.test(k0) ? k0 : DAY_KEY_INDEX[k0.toLowerCase()] ? String(DAY_KEY_INDEX[k0.toLowerCase()]) : null;
    if (!k || !Array.isArray(v)) continue;
    const hours = v.map(Number).filter((h) => Number.isFinite(h) && h >= 0 && h <= 23).sort((a, b) => a - b);
    out[fromNaverDay(k)] = hours;
    any = true;
  }
  if (!any) return null;
  for (let d = 0; d < 7; d++) out[d] ??= [];
  // 7일 모두 24시간이면 사실상 '항상'
  if (Object.values(out).every((h) => h.length === 24)) return null;
  return out;
}

/** 우리 형식 → 네이버 target 객체. null(항상)은 모든 요일 0~23. 네이버 키 형식이 문서마다 달라 두 가지(숫자 1~7 / mon~sun)를 지원한다. */
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export function buildTimeTarget(schedule: WeekSchedule | null, variant: "num" | "name" = "num"): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (let d = 0; d < 7; d++) {
    const key = variant === "num" ? String(toNaverDay(d)) : DAY_KEYS[toNaverDay(d) - 1];
    out[key] = schedule ? [...(schedule[d] ?? [])].sort((a, b) => a - b) : Array.from({ length: 24 }, (_, h) => h);
  }
  return out;
}
const DAY_KEY_INDEX: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };

export async function listAdgroups(acct: NaverAcct, campaignId: string): Promise<NaverAdgroup[]> {
  const rows = (await callNaver<NaverAdgroup[]>(acct, "/ncc/adgroups", { nccCampaignId: campaignId })) ?? [];
  return rows.filter((g) => g.status !== "DELETED");
}

export async function getAdgroup(acct: NaverAcct, adgroupId: string): Promise<NaverAdgroup> {
  return callNaver<NaverAdgroup>(acct, `/ncc/adgroups/${adgroupId}`);
}

/** 광고그룹 노출 시간 저장. 기존 targets 중 TIME_WEEKLY_TARGET만 바꿔 fields=targetTime 으로 보낸다. */
export async function setAdgroupSchedule(acct: NaverAcct, adgroupId: string, schedule: WeekSchedule | null): Promise<NaverAdgroup> {
  const g = await getAdgroup(acct, adgroupId);
  const attempt = (variant: "num" | "name") => {
    const target = buildTimeTarget(schedule, variant);
    const targets = (g.targets ?? []).map((t) => (t.targetTp === "TIME_WEEKLY_TARGET" ? { ...t, target } : t));
    if (!targets.some((t) => t.targetTp === "TIME_WEEKLY_TARGET")) targets.push({ ownerId: adgroupId, targetTp: "TIME_WEEKLY_TARGET", target });
    return callNaverWrite<NaverAdgroup>(acct, "PUT", `/ncc/adgroups/${adgroupId}`, { ...g, targets }, { fields: "targetTime" });
  };
  // 숫자 키(1~7)로 먼저, 네이버가 거부하면 요일 이름 키로 한 번 더
  try {
    return await attempt("num");
  } catch (e) {
    const err = e as NaverApiError;
    if (err.status && err.status >= 500) throw e;
    return attempt("name");
  }
}

/* ---------- 키워드 도구 (연관 키워드 + 월 검색량) ---------- */
export type KeywordIdea = { keyword: string; pc: number; mobile: number; total: number; compIdx: string | null };
const qc = (v: unknown) => {
  // 네이버는 10 미만을 "< 10" 문자열로 준다
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (s.startsWith("<")) return 5;
  const n = Number(s.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
/** hintKeywords(최대 5개)로 연관 키워드와 월 검색량을 받는다. */
export async function keywordTool(acct: NaverAcct, hints: string[]): Promise<KeywordIdea[]> {
  const out: KeywordIdea[] = [];
  for (let i = 0; i < hints.length; i += 5) {
    const r = await callNaver<{ keywordList?: { relKeyword?: string; monthlyPcQcCnt?: unknown; monthlyMobileQcCnt?: unknown; compIdx?: string }[] }>(acct, "/keywordstool", {
      hintKeywords: hints.slice(i, i + 5).map((h) => h.replace(/\s+/g, "")).join(","),
      showDetail: "1",
    });
    for (const k of r?.keywordList ?? []) {
      if (!k.relKeyword) continue;
      const pc = qc(k.monthlyPcQcCnt);
      const mobile = qc(k.monthlyMobileQcCnt);
      out.push({ keyword: k.relKeyword, pc, mobile, total: pc + mobile, compIdx: k.compIdx ?? null });
    }
  }
  // 중복 제거, 검색량 큰 순
  const seen = new Map<string, KeywordIdea>();
  for (const k of out) if (!seen.has(k.keyword) || seen.get(k.keyword)!.total < k.total) seen.set(k.keyword, k);
  return [...seen.values()].sort((a, b) => b.total - a.total);
}
