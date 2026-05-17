# Research: Carelog PWA + 푸시 알림

## 1. PWA Manifest & 설치

**Decision**: `app/manifest.ts` (Next.js 16 App Router 방식)으로 manifest 생성.  
**Rationale**: Next.js 16에서 `app/manifest.ts`를 export하면 `/manifest.webmanifest` 엔드포인트가 자동 생성됨. 별도 `public/manifest.json` 필요 없음.  
**Alternatives considered**: `next-pwa` 패키지 — Workbox 기반이나 Next.js 16 App Router와 호환성 이슈 존재. 직접 구현이 더 안정적.

## 2. Service Worker

**Decision**: `public/sw.js`를 직접 작성. Next.js App Router에서는 `next-pwa` 없이 직접 SW 등록.  
**Rationale**: Workbox 없이 Fetch 이벤트(오프라인 캐시)와 Push 이벤트(푸시 알림)만 처리하는 경량 SW로 충분. `app/layout.tsx`에서 `navigator.serviceWorker.register('/sw.js')` 호출.  
**Alternatives considered**: `next-pwa` — 자동 precaching 지원하나 App Router에서 config 복잡. `@serwist/next` — 더 최신이나 추가 학습 비용.

## 3. Web Push / VAPID

**Decision**: `web-push` npm 패키지 + VAPID 키쌍 사용.  
**Rationale**: 표준 Web Push Protocol 구현체. Next.js Server Action에서 `webpush.sendNotification()` 호출. VAPID 키는 환경변수로 관리(`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).  
**Alternatives considered**: Firebase Cloud Messaging — Google 의존성 증가, 추가 설정 복잡. 자체 구현 — RFC 8030 직접 구현은 불필요한 복잡도.

## 4. Push Subscription 저장

**Decision**: Supabase `push_subscriptions` 테이블. 컬럼: `id`, `user_id`, `institution_id`, `endpoint`, `p256dh`, `auth`, `created_at`.  
**Rationale**: 기존 RLS 패턴(institution_id 기반)과 일관성. Server Action으로 구독 저장/삭제.  
**Alternatives considered**: localStorage — 서버에서 알림 발송 불가. Redis — 별도 인프라 필요.

## 5. 알림 트리거 시점

**Decision**: `consultation` INSERT 이후 기존 `_log_consultation_created` DB 트리거와 동일 시점에, Server Action(`saveConsultation`) 내부에서 푸시 발송 Server Action 호출.  
**Rationale**: DB 트리거 내에서 HTTP 요청은 불가. Server Action 완료 후 `sendPushToInstitution(institutionId, payload)` 비동기 호출이 가장 단순.  
**Alternatives considered**: Supabase Edge Functions — 별도 배포 파이프라인 필요. Vercel Cron — 실시간성 부족.

## 6. 세션 자동 갱신 (항시 로그인)

**Decision**: Supabase Auth `@supabase/ssr`의 기본 동작 활용 + `createBrowserSupabaseClient()`에서 `autoRefreshToken: true`(기본값) 유지.  
**Rationale**: `@supabase/ssr`은 쿠키 기반 세션을 사용하며 `access_token` 만료 전 자동으로 `refresh_token`으로 갱신함. 클라이언트 컴포넌트에서 `supabase.auth.onAuthStateChange` 리스너로 세션 복원 감지.  
**Alternatives considered**: 커스텀 토큰 갱신 로직 — 중복 구현.

## 7. 헤더 sticky + 새로고침 버튼

**Decision**: 헤더는 이미 `sticky top-0 z-40`으로 고정됨. 새로고침 버튼은 `<RefreshButton>` 클라이언트 컴포넌트 — `router.refresh()` 호출.  
**Rationale**: Next.js `router.refresh()`는 현재 경로를 서버에서 재렌더링하여 최신 데이터를 가져옴. 페이지 전체 reload 없이 RSC 데이터만 갱신.  
**Alternatives considered**: `window.location.reload()` — 전체 페이지 재로드, 스크롤 위치 손실.

## 8. 아이콘 생성

**Decision**: `public/icons/` 폴더에 SVG 기반 아이콘 (192×192, 512×512 PNG).  
**Rationale**: 'C' 로고 + 하늘색(sky-600) 배경으로 기존 헤더 아이콘과 일관성. Vercel 배포 환경에서 정적 파일로 제공.  
**Alternatives considered**: `next/og` 동적 이미지 — manifest 아이콘은 정적 URL 필요.

## 9. iOS PWA 고려사항

**Decision**: `<meta name="apple-mobile-web-app-*">` 태그 + `apple-touch-icon` 링크 추가.  
**Rationale**: iOS Safari는 표준 manifest의 일부 필드를 무시하고 Apple 전용 메타태그를 별도로 필요로 함. iOS 16.4+ Web Push 지원이지만 앱 설치 후에만 동작.  
**Alternatives considered**: Apple 전용 무시 — iOS 사용자 경험 저하.

## 10. 알림 권한 요청 UI

**Decision**: 홈 화면 상단 배너 형태 — "알림 받기" 버튼 클릭 시 브라우저 권한 요청. 이미 허용/거부된 경우 배너 미표시.  
**Rationale**: 사용자가 자발적으로 클릭해야 `Notification.requestPermission()`이 효과적 (자동 팝업은 브라우저에서 차단).  
**Alternatives considered**: 페이지 로드 즉시 요청 — 브라우저에서 자동 차단됨.
