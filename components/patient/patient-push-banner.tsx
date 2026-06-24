"use client";

import { useEffect, useState } from "react";
import { subscribePatientPush } from "@/app/actions/patient-portal";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function PatientPushBanner() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  if (!permission || permission !== "default" || dismissed) return null;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return null;

  async function handleAllow() {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey!) as unknown as ArrayBuffer,
      });
      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await subscribePatientPush(json);
    } catch {
      // 구독 실패 시 무시
    }
  }

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg bg-sky-50 border border-sky-100 px-4 py-3">
      <p className="text-sm text-sky-800">
        새 상담 기록 알림을 받으시겠어요?
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleAllow}
          className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700"
        >
          알림 받기
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
