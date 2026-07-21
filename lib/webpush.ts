import webpush from "web-push";

let configured = false;

// VAPID 키가 설정된 경우에만 초기화한다. 로컬 개발 환경 등 키가 없는 곳에서는
// 푸시 발송을 조용히 건너뛴다.
function ensureConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  if (!configured) {
    webpush.setVapidDetails(
      "mailto:owner@jadewater.com",
      publicKey,
      privateKey
    );
    configured = true;
  }
  return true;
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

// 실패해도 상위 로직(요청완료 처리)이 깨지지 않도록 항상 조용히 실패한다.
// 구독이 만료된 경우(404/410)에는 true를 반환해 호출부에서 DB 정리를 하게 한다.
export async function sendPush(
  subscription: PushSubscriptionKeys,
  payload: PushPayload
): Promise<{ expired: boolean }> {
  if (!ensureConfigured()) return { expired: false };

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    return { expired: false };
  } catch (err) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    return { expired: statusCode === 404 || statusCode === 410 };
  }
}
