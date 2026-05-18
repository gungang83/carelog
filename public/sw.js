// Carelog Service Worker — Web Push + 배지 + 캐싱 최적화
const CACHE_NAME = "carelog-v2";
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

  // 기타 /_next/ 경로 — 브라우저 캐시에 위임
  if (url.pathname.startsWith("/_next/")) return;

  // API / Server Action — 캐시 안 함
  if (url.pathname.startsWith("/api/")) return;

  // 네비게이션 요청 — 네트워크 우선, 실패 시 캐시 폴백
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
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

  const { title = "Carelog", body = "", url = "/", icon = "/icons/icon-192.png" } = payload;

  badgeCount += 1;

  event.waitUntil(
    Promise.all([
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
    ])
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
