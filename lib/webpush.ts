let configured = false;
let configError: string | null = null;

// Vercel 환경변수에 VAPID 키를 넣을 때 표준 base64(+, /, = 패딩)로 들어가는 경우가 있다.
// web-push는 URL-safe base64(패딩 없음)만 받으므로 여기서 맞춰 준다.
function normalizeVapidKey(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  return raw.trim().replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

// web-push는 동적으로 불러온다. 모듈 로드나 VAPID 설정 자체가 실패해도
// 요청완료 같은 핵심 흐름에는 절대 영향이 없어야 하기 때문이다.
async function loadConfiguredWebPush() {
  const publicKey = normalizeVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const privateKey = normalizeVapidKey(process.env.VAPID_PRIVATE_KEY);
  if (!publicKey || !privateKey) {
    configError = `VAPID 환경변수 없음 (public=${!!publicKey}, private=${!!privateKey})`;
    console.error(`[webpush] ${configError}`);
    return null;
  }

  try {
    const { default: webpush } = await import("web-push");
    if (!configured) {
      webpush.setVapidDetails(
        "mailto:owner@bestmateco.com",
        publicKey,
        privateKey
      );
      configured = true;
      console.log(
        `[webpush] VAPID 설정 완료 (public 길이=${publicKey.length}, private 길이=${privateKey.length})`
      );
    }
    return webpush;
  } catch (err) {
    configError = `VAPID 설정 실패: ${err instanceof Error ? err.message : String(err)}`;
    console.error("[webpush] VAPID 설정 실패", err);
    return null;
  }
}

// 헬스체크용 — 푸시를 실제로 보낼 수 있는 상태인지(키 형식까지) 확인한다.
export async function webPushStatus(): Promise<{ ok: boolean; reason?: string }> {
  const webpush = await loadConfiguredWebPush();
  return webpush ? { ok: true } : { ok: false, reason: configError ?? "원인 불명" };
}

// 실패해도 상위 로직(요청완료 처리)이 깨지지 않도록 항상 조용히 실패한다.
// 구독이 만료된 경우(404/410)에는 true를 반환해 호출부에서 DB 정리를 하게 한다.
export async function sendPush(
  subscription: PushSubscriptionKeys,
  payload: PushPayload
): Promise<{ expired: boolean; sent: boolean }> {
  const endpointTail = subscription.endpoint.slice(-12);
  const webpush = await loadConfiguredWebPush();
  if (!webpush) {
    console.error(`[webpush] VAPID 미설정으로 발송 건너뜀 (endpoint ...${endpointTail})`);
    return { expired: false, sent: false };
  }

  try {
    const result = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    console.log(
      `[webpush] 발송 성공 (endpoint ...${endpointTail}, statusCode=${result.statusCode})`
    );
    return { expired: false, sent: true };
  } catch (err) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    const body =
      err && typeof err === "object" && "body" in err
        ? (err as { body?: string }).body
        : undefined;
    console.error(
      `[webpush] 발송 실패 (endpoint ...${endpointTail}, statusCode=${statusCode})`,
      body ?? (err instanceof Error ? err.message : err)
    );
    return { expired: statusCode === 404 || statusCode === 410, sent: false };
  }
}
