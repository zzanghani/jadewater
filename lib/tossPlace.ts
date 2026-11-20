// 토스플레이스 Open API (서버 전용). 키는 DB(toss_settings)에만 있고 브라우저로 안 나간다.
// 인증: x-access-key / x-secret-key 헤더. 가맹점은 경로의 merchantId로 구분한다.
const BASE = "https://open-api.tossplace.com/api-public/openapi/v1";

export type TossKeys = { accessKey: string; secretKey: string };

/** 매장 ↔ 상점 번호 연결. 사업자 전환 등으로 번호가 바뀌면 옛 번호를 prev_merchant_id에, 옛 번호가 유효한 마지막 날을 prev_until에 둔다. */
export type TossMerchantLink = { merchant_id: string; prev_merchant_id?: string | null; prev_until?: string | null };
/** 그 날짜의 매출을 어느 상점 번호로 읽어야 하는지. prev_until까지는 옛 번호, 그 뒤는 새 번호. */
export function merchantFor(link: TossMerchantLink | string, ymd: string): string {
  if (typeof link === "string") return link;
  if (link.prev_merchant_id && link.prev_until && ymd <= link.prev_until) return link.prev_merchant_id;
  return link.merchant_id;
}

export class TossApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function callToss<T = unknown>(
  keys: TossKeys,
  path: string,
  query: Record<string, string | number | undefined> = {}
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") qs.append(k, String(v));
  const url = BASE + path + (qs.toString() ? `?${qs}` : "");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "x-access-key": keys.accessKey,
        "x-secret-key": keys.secretKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
  } catch (e) {
    const err = e as Error;
    throw new TossApiError(err.name === "TimeoutError" ? "토스 응답이 12초 넘게 없습니다." : err.message, 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  // 토스 응답은 { resultType: "SUCCESS"|"FAIL", success: <본문>, error: { errorCode, reason } } 한 겹으로 싸여 온다.
  const env = (data ?? {}) as { resultType?: string; success?: unknown; error?: { errorCode?: string; reason?: string; message?: string }; message?: string; raw?: string };
  if (res.status >= 400 || env.resultType === "FAIL") {
    const msg = env.error?.reason || env.error?.message || env.message || env.raw || `토스 API 오류 (${res.status})`;
    throw new TossApiError(res.status === 401 || res.status === 403 ? `인증 실패 — 키를 확인해 주세요 (${msg})` : msg, res.status);
  }
  return (env.resultType === "SUCCESS" || "success" in env ? env.success : data) as T;
}

export type TossMerchant = { id?: string | number; name?: string; businessNumber?: string; [k: string]: unknown };

/** 키와 가맹점 ID가 맞는지 확인하는 가장 가벼운 호출 — 매장 정보 조회. */
export async function testTossMerchant(keys: TossKeys, merchantId: string): Promise<{ ok: true; merchant: TossMerchant } | { ok: false; error: string }> {
  try {
    const r = await callToss<TossMerchant>(keys, `/merchants/${encodeURIComponent(merchantId)}`);
    return { ok: true, merchant: r ?? {} };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
