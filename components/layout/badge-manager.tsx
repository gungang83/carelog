"use client";

import { useEffect } from "react";

export function BadgeManager() {
  useEffect(() => {
    // SW에 배지 초기화 메시지 전송
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_BADGE" });
    }

    // 클라이언트 측에서도 직접 초기화 (SW가 없는 환경 대비)
    if ("clearAppBadge" in navigator) {
      (navigator as Navigator & { clearAppBadge: () => Promise<void> })
        .clearAppBadge()
        .catch(() => {});
    }
  }, []);

  return null;
}
