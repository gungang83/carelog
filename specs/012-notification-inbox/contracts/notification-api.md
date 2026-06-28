# Contract: 알림 API + lib (spec 012)

인증: `getSessionUser()`(Supabase 세션) 필수 — 미인증 401. 역할은 `institution_members`로 판정. 결과는 EO 동형 JSON.

## Route Handlers

### `GET /api/notifications`
- 응답: `{ notifications: NotificationItem[], email }`
- 동작: `getNotifications({userId, email, role, institutionId})` 위임. 기관 알림 100건 + 내 read → isRead → recipients 필터 → 50건(최신순).

### `POST /api/notifications/[id]/read`
- 동작: `markNotificationRead(userId, id)` (upsert). 응답 `{ ok: true }`.

### `PATCH /api/notifications/[id]/read`  body `{ is_read?: boolean }`
- `is_read === false` → `markNotificationUnread(userId, id)`(delete), 그 외 → markRead. 응답 `{ ok: true }`.

### `POST /api/notifications/read-all`
- 동작: `markAllNotificationsRead(userId, email, role, institutionId)` — 내 미읽음 dedup 후 일괄 upsert. 응답 `{ ok: true }`.

> Next 16: 동적 `[id]`는 `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params`(번들 문서 기준).

## lib/notifications.ts (서버)

```ts
type Recipients = "all" | "admins" | string; // 특정 이메일

// 적재 + 푸시 통합. 적재 실패 비차단(상담 저장·푸시를 막지 않음).
sendNotification(opts: {
  title: string; body: string; type: string; link: string;
  recipients?: Recipients; institutionId: string; createdBy?: string | null;
}): Promise<void>

getNotifications(ctx: {
  userId: string; email: string; role: string; institutionId: string;
}): Promise<NotificationItem[]>   // isRead 계산·recipients 필터·50건

markNotificationRead(userId: string, notificationId: string): Promise<void>   // upsert
markNotificationUnread(userId: string, notificationId: string): Promise<void> // delete
markAllNotificationsRead(ctx): Promise<void>                                  // 미읽음 dedup 일괄 upsert
```

- 적재·읽음은 **admin client**(RLS 우회, 서버 권위)로 수행. 조회는 admin로 기관/본인 스코프 명시 필터.
- recipients 필터: 'all'→전체, 'admins'→role admin, 이메일→본인 일치.

## 브라우저 구독 (lib/realtime/institution-events.ts 추가)
```ts
subscribeNotifications(opts: {
  institutionId: string;
  onEvent: (row: NotificationRow) => void;
  onSubscribed?: () => void;
}): () => void   // notifications INSERT, filter institution_id=eq.{id}
```

## NotificationBell (클라이언트 계약)
- mount: `GET /api/notifications` + `subscribeNotifications` 구독 + 30초 폴백 setInterval.
- 미읽음 수 = isRead=false 개수 → 배지(9+) + `navigator.setAppBadge`(지원 시).
- 클릭: `markRead`(낙관적) → `POST /[id]/read` → link 이동, 드롭다운 닫기.
- ✓토글: `PATCH /[id]/read {is_read:false}`. 전체읽음: `POST /read-all`.
- 외부 클릭 닫기. Carelog 팔레트(sky/emerald).

## 배선 계약 (기존 푸시 호출부)
- `chairs.saveChairRecord`(새 상담 기록): 기존 `sendPushToInstitution` 자리에 `sendNotification({type:'consultation_saved', title, body(요약·PII無), link:'/records', recipients:'all', institutionId, createdBy})`. (sendNotification 내부가 푸시도 발송 → 중복 방지 위해 기존 직접 push 호출은 sendNotification로 대체)
- `consultations.saveConsultation`: 동일 패턴(link 환자상세 등).
- **불변**: 환자용 `sendPushToPatient`는 알림함 적재 안 함(직원 알림함 분리). 기존 실시간 토스트(LiveAlertsProvider)·헤더 회귀 0.
