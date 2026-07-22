"use client";

import { useEffect, useState } from "react";
import { savePushSubscription } from "@/app/actions/push";

type Status = "checking" | "idle" | "subscribed" | "unsupported" | "denied" | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushSubscribeButton({
  storeId,
}: {
  storeId: string | null;
}) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setStatus("unsupported");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "subscribed" : "idle");
      })
      .catch(() => setStatus("error"));
  }, []);

  async function handleSubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setStatus("error");
        return;
      }

      const result = await savePushSubscription({
        storeId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });

      setStatus(result.error ? "error" : "subscribed");
    } catch {
      setStatus("error");
    }
  }

  if (status === "checking" || status === "unsupported") return null;

  const label = storeId ? "요청완료 알림 받기" : "새 입금요청 알림 받기";
  const subscribedLabel = storeId
    ? "🔔 요청완료 알림이 설정되어 있습니다."
    : "🔔 새 입금요청 알림이 설정되어 있습니다.";

  if (status === "subscribed") {
    return <p className="text-xs text-muted">{subscribedLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleSubscribe}
        className="self-start rounded-full border border-brand bg-brand/10 px-4 py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand/20"
      >
        🔔 {label}
      </button>
      {status === "denied" && (
        <p className="text-xs text-red-600">
          알림 권한이 거부되었습니다. 휴대폰/브라우저 설정에서 알림 권한을 허용해 주세요.
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-600">
          알림 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}
