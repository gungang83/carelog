// Carelog Service Worker — Web Push + 배지 + 캐싱 최적화
// v3: 네비게이션(HTML) 캐싱 제거 — 인증 상태가 섞이던 버그 수정(아래 fetch 참고)
const CACHE_NAME = "carelog-v3";
const STATIC_CACHE = "carelog-static-v2";

// 푸시 수신 후 앱 열기 전까지 누적되는 배지 카운트
let badgeCount = 0;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
      .then(() => {
        // 서버리스 함수 워밍업 (cold start 방지)
        fetch("/api/health", { cache: "no-store" }).catch(() => {});
      })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // /_next/static/ — 해시 파일명으로 불변, cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }

  // 그 외(HTML 네비게이션 · API · _next 데이터 등)는 SW가 가로채지 않고
  // 항상 네트워크로 보낸다.
  //
  // ⚠️ 과거에는 네비게이션 응답(HTML)을 CACHE_NAME에 저장하고 네트워크 실패 시
  //    폴백했는데, 이 HTML에는 로그인/로그아웃 상태가 그대로 박혀 있어:
  //      - 로그인 상태인데 '서비스 소개'(/about)가 로그아웃 화면(로그인/시작하기)으로 보임
  //      - 반대로 로그아웃 후에도 캐시된 보호 화면이 잠깐 노출
  //    하는 문제가 있었다. 인증 상태가 담긴 HTML은 절대 SW가 캐시하면 안 되므로
  //    네비게이션은 가로채지 않는다. 정적 자산(/_next/static/)만 위에서 캐시한다.
});

// 클라이언트 → SW 메시지 처리
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_BADGE") {
    badgeCount = 0;
    if (self.registration.clearAppBadge) {
      self.registration.clearAppBadge().catch(() => {});
    }
  }
});

// Web Push 수신
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Carelog", body: event.data.text(), url: "/" };
  }

  const { title = "Carelog", body = "", url = "/", icon = "/icons/icon-192.png", kind } = payload;

  event.waitUntil(
    (async () => {
      // 실시간 인앱 알림(spec 007)과 중복 방지(FR-010): 체어 기록 푸시는
      // 이 기기에 포커스된 창이 있으면 OS 알림/배지를 생략한다(인앱 토스트가 처리).
      if (kind === "chair-record") {
        const wins = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const focused = wins.some(
          (c) => c.focused || c.visibilityState === "visible",
        );
        if (focused) return;
      }

      badgeCount += 1;
      await Promise.all([
        self.registration.showNotification(title, {
          body,
          icon,
          badge: "/icons/icon-192.png",
          data: { url },
          requireInteraction: false,
        }),
        // 홈 화면 아이콘 배지 업데이트
        self.registration.setAppBadge
          ? self.registration.setAppBadge(badgeCount).catch(() => {})
          : Promise.resolve(),
      ]);
    })()
  );
});

// 알림 탭 → 해당 URL로 이동 + 배지 초기화
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  // 알림을 직접 탭하면 배지도 초기화
  badgeCount = 0;
  if (self.registration.clearAppBadge) {
    self.registration.clearAppBadge().catch(() => {});
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
