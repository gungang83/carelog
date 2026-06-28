# Phase 1 Data Model: 알림함

## 신규 테이블

### notifications (broadcast 메시지)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid pk default gen_random_uuid() | 알림 고유 id |
| institution_id | uuid not null | 기관 격리(references institutions(id) on delete cascade) |
| created_at | timestamptz not null default now() | 생성시각(최신순 정렬) |
| title | text not null | 제목 |
| body | text | 본문(PII 평문 금지) |
| type | text not null default 'system' | consultation_saved / consultation_linked / system / announcement … |
| link | text not null default '/' | 클릭 시 이동 경로 |
| recipients | text not null default 'all' | 'all' \| 'admins' \| 특정 이메일 |
| created_by | uuid | 발생시킨 사용자(있으면) |

- 인덱스: `(institution_id, created_at desc)`.
- RLS: select = 같은 기관 멤버(`institution_id = get_my_institution_id()` 또는 institution_members 서브쿼리, chair_audit_logs 정책과 동일 패턴) · service_role full(서버 적재).
- Realtime: `alter publication supabase_realtime add table public.notifications;`

### notification_reads (유저별 읽음 표시 — 행 존재 = 읽음)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| notification_id | uuid not null references notifications(id) on delete cascade | |
| user_id | uuid not null | 읽은 사용자(auth.uid()) |
| created_at | timestamptz not null default now() | 읽은 시각 |

- 제약: `unique(notification_id, user_id)` — 멱등 upsert 키.
- 인덱스: `(user_id)`.
- RLS: 본인만 — select/insert/delete `using (user_id = auth.uid())` · service_role full.

## 기존 타입 확장 (lib/types/database.ts)
```ts
export type NotificationRow = {
  id: string;
  institution_id: string;
  created_at: string;
  title: string;
  body: string | null;
  type: string;
  link: string;
  recipients: string; // 'all' | 'admins' | email
  created_by: string | null;
};
export type NotificationReadRow = {
  id: string;
  notification_id: string;
  user_id: string;
  created_at: string;
};
// 벨/조회 표시용(읽음 계산 포함)
export type NotificationItem = {
  id: string;
  timestamp: string;
  title: string;
  body: string;
  type: string;
  link: string;
  isRead: boolean;
};
```

## 도출 규칙
- **isRead** = 해당 user_id의 notification_reads 행 존재.
- **대상 필터**: recipients 'all' → 모두 / 'admins' → role admin / 이메일 → 본인 이메일 일치.
- **격리**: institution_id = 내 기관(RLS + 조회 필터 이중).
- **정렬·상한**: created_at desc, 최근 50건.
- **PII**: title/body는 요약 카피만(예 "○○ 체어에 새 상담 기록"); 환자 주민번호·전화 평문 금지.

## 상태 흐름
```
[이벤트 발생: saveChairRecord/saveConsultation]
   → sendNotification(): notifications insert(admin) + sendPushToInstitution
   → Realtime INSERT 신호 → 벨 재fetch + 배지 갱신 + setAppBadge
[유저가 봄]
   클릭 → markRead(upsert) + link 이동 / ✓토글 → markUnread(delete) / 전체읽음 → markAllRead
```
