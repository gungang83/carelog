"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { menuIdFromPath, MENU_IDS } from "@/lib/usage/menu-config";

// spec 013 — 화면 진입 추적. pathname 변경 시 menu_id를 track API로 비동기 전송.
//   sendBeacon(실패해도 UX 무방해). 화이트리스트 메뉴만. 세션·역할은 서버가 확인.
export function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const menuId = menuIdFromPath(pathname);
    if (!MENU_IDS.has(menuId)) return;

    const payload = JSON.stringify({ menuId });
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/menu-usage/track", new Blob([payload], { type: "application/json" }));
      } else {
        fetch("/api/menu-usage/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* 추적 실패 무시 */
    }
  }, [pathname]);

  return null;
}
