# API Contracts: PWA Push Notifications

## Server Actions

### `subscribePush(subscription: PushSubscriptionJSON): Promise<{ ok: boolean; message?: string }>`

사용자의 기기를 푸시 알림 수신자로 등록.

**Input**:
```typescript
{
  endpoint: string;        // Web Push endpoint URL
  keys: {
    p256dh: string;        // 암호화 공개키 (base64url)
    auth: string;          // 인증 시크릿 (base64url)
  };
}
```

**Output**: `{ ok: true }` | `{ ok: false; message: string }`

**Authorization**: 로그인 사용자만 자신의 구독을 등록할 수 있음.

---

### `unsubscribePush(endpoint: string): Promise<{ ok: boolean; message?: string }>`

특정 기기의 푸시 구독을 해제.

**Input**: `endpoint` — 해제할 구독의 엔드포인트 URL

**Output**: `{ ok: true }` | `{ ok: false; message: string }`

---

### `sendPushToInstitution(institutionId: string, payload: PushPayload): Promise<void>`

기관 내 모든 구독 기기로 푸시 알림 발송. (내부 Server Action — 직접 호출 불가)

**Payload**:
```typescript
{
  title: string;           // 알림 제목 (예: "새 상담 기록")
  body: string;            // 알림 본문 (예: "홍길동 — 주소증: ...")
  url: string;             // 탭 시 이동할 URL (예: "/patients/42#consultation-17")
  icon?: string;           // 알림 아이콘 URL (기본: /icons/icon-192.png)
}
```

---

## Service Worker Events

### `push` event

백그라운드에서 수신되는 Web Push 메시지 처리.

**Payload format** (JSON):
```typescript
{
  title: string;
  body: string;
  url: string;
  icon: string;
}
```

### `notificationclick` event

알림 탭 시 처리:
1. 알림 닫기
2. `clients.openWindow(event.notification.data.url)` — 해당 URL로 이동

---

## Manifest Contract (`/manifest.webmanifest`)

```json
{
  "name": "Carelog",
  "short_name": "Carelog",
  "description": "치과 환자 상담 기록",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0284c7",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
