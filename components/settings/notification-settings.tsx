"use client";

import { useEffect, useState } from "react";
import { subscribePush, unsubscribePush } from "@/app/actions/push";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function NotificationSettings() {
  const [status, setStatus] = useState<"loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function check() {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "subscribed" : "unsubscribed");
    }
    check();
  }, []);

  async function handleSubscribe() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setStatus("denied"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as unknown as ArrayBuffer,
      });
      const json = sub.toJSON();
      await subscribePush({ endpoint: json.endpoint!, keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth } });
      setStatus("subscribed");
    } catch { /* 권한 거부 */ }
    finally { setBusy(false); }
  }

  async function handleUnsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("unsubscribed");
    } catch { /* 오류 무시 */ }
    finally { setBusy(false); }
  }

  if (status === "loading") {
    return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm text-sm text-slate-400">확인 중...</div>;
  }

  if (status === "unsupported") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">이 기기 또는 브라우저는 푸시 알림을 지원하지 않습니다.</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
        <p className="text-sm font-medium text-amber-800">알림이 차단되어 있습니다.</p>
        <p className="mt-1 text-xs text-amber-600">브라우저 설정에서 Carelog의 알림을 허용해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {status === "subscribed" ? "알림 수신 중" : "알림 꺼짐"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {status === "subscribed"
              ? "새 상담 기록이 저장되면 이 기기로 알림이 발송됩니다."
              : "알림을 활성화하면 새 상담 기록 시 즉시 알림을 받습니다."}
          </p>
        </div>
        {status === "subscribed" ? (
          <button
            type="button"
            onClick={handleUnsubscribe}
            disabled={busy}
            className="inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            {busy ? "처리 중..." : "알림 해제"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={busy}
            className="inline-flex shrink-0 items-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
          >
            {busy ? "처리 중..." : "알림 활성화"}
          </button>
        )}
      </div>
    </div>
  );
}
