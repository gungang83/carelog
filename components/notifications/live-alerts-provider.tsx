"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { subscribeChairEvents } from "@/lib/realtime/institution-events";
import { AlertToastStack, type ToastItem } from "./alert-toast";
import { playAlertSound } from "./alert-sound";

/**
 * 실시간 체어 상담기록 알림 (spec 007 US1+US2).
 * 같은 기관의 chair_audit_logs(record_created)를 구독해 토스트+목록갱신(+소리)을 띄운다.
 * - 본인이 올린 기록은 토스트/소리 생략(에코 방지), 목록만 갱신.
 * - 다발 도착은 새로고침/소리 디바운스.
 * - 목록 데이터는 router.refresh()로 서버에서만 재조회(헌법 II) — payload는 트리거로만.
 */
const TOAST_TTL_MS = 6000;
const REFRESH_DEBOUNCE_MS = 400;
const SOUND_THROTTLE_MS = 1500;
const MAX_TOASTS = 3;

export function LiveAlertsProvider({
  currentUserId,
  institutionId,
  chairNames,
}: {
  currentUserId: string;
  institutionId: string;
  chairNames: Record<string, string>;
}) {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const seen = useRef<Set<string>>(new Set());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSoundAt = useRef(0);
  const firstSubscribe = useRef(true);
  const chairNamesRef = useRef(chairNames);
  chairNamesRef.current = chairNames;

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(
      () => router.refresh(),
      REFRESH_DEBOUNCE_MS,
    );
  }, [router]);

  useEffect(() => {
    if (!institutionId) return;

    const unsubscribe = subscribeChairEvents({
      institutionId,
      onSubscribed: () => {
        // 최초 구독은 무시. 끊겼다 재SUBSCRIBED될 때만 놓친 변경을 재동기화(FR-011).
        if (firstSubscribe.current) {
          firstSubscribe.current = false;
          return;
        }
        scheduleRefresh();
      },
      onEvent: (event) => {
        if (event.event_type !== "record_created") return;
        if (seen.current.has(event.id)) return;
        seen.current.add(event.id);

        // 목록은 본인 포함 모두 갱신
        scheduleRefresh();

        // 본인이 올린 기록이면 토스트·소리 생략(에코 방지)
        if (event.actor_user_id === currentUserId) return;

        const chairName =
          (event.chair_id && chairNamesRef.current[event.chair_id]) || "체어";
        const id = event.id;
        setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, chairName }]);
        setTimeout(() => dismiss(id), TOAST_TTL_MS);

        const now = Date.now();
        if (now - lastSoundAt.current > SOUND_THROTTLE_MS) {
          lastSoundAt.current = now;
          playAlertSound();
        }
      },
    });

    return () => {
      unsubscribe();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [institutionId, currentUserId, scheduleRefresh, dismiss]);

  return <AlertToastStack toasts={toasts} onDismiss={dismiss} />;
}
