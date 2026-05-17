"use client";

import { useEffect, useState } from "react";
import { subscribePush } from "@/app/actions/push";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function PushNotificationBanner() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  if (permission === "granted" && subscribed) return null;
  if (permission === "granted") return null;
  if (permission === "denied" || permission === "unsupported") return null;

  async function handleAllow() {
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ) as unknown as ArrayBuffer,
      });

      const json = sub.toJSON();
      await subscribePush({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });
      setSubscribed(true);
    } catch {
      // 사용자 거부 또는 오류
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-sky-800">새 상담 알림 받기</p>
        <p className="text-xs text-sky-600">상담 기록이 저장되면 즉시 알림을 받을 수 있습니다.</p>
      </div>
      <button
        type="button"
        onClick={handleAllow}
        disabled={loading}
        className="inline-flex shrink-0 items-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
      >
        {loading ? "처리 중..." : "알림 받기"}
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
