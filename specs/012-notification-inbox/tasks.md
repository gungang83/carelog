# Tasks: 알림함 (Notification Inbox) — 012

**Tests**: 프로젝트 무 하네스 → 테스트 task 없음(quickstart 수동 검증). **제약**: 마이그레이션·RLS 동반, PII 평문 미노출, 기존 헤더·실시간 토스트 회귀 0, 새 라이브러리 0.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup
(별도 setup 없음 — 신규 의존성 0. Foundational부터 시작.)

## Phase 2: Foundational (Blocking) ⚠️
**완료 전 어떤 스토리도 동작 불가.**

- [ ] T001 `supabase/migrations/20260628000001_notifications.sql` 신규: `notifications`(id uuid pk, institution_id, created_at, title, body, type, link, recipients default 'all', created_by) + `notification_reads`(id, notification_id fk on delete cascade, user_id, created_at, unique(notification_id,user_id)) + 인덱스 + **RLS**(notifications=기관 멤버 select·service_role full / notification_reads=본인 auth.uid() select·insert·delete·service_role full) + `alter publication supabase_realtime add table public.notifications;`. **`supabase/schema.sql`·`docs/database.md` 동반 갱신**(헌법 III/VI).
- [ ] T002 [P] `lib/types/database.ts`: `NotificationRow`·`NotificationReadRow`·`NotificationItem`(isRead 포함) 추가.
- [ ] T003 `lib/notifications.ts` 신규: `sendNotification({title,body,type,link,recipients?,institutionId,createdBy?})`(admin insert + `sendPushToInstitution`, 적재 비차단) · `getNotifications({userId,email,role,institutionId})`(기관 100건 + 내 read → isRead → recipients 필터(all/admins/이메일) → 50건) · `markNotificationRead`(upsert) · `markNotificationUnread`(delete) · `markAllNotificationsRead`(미읽음 dedup 일괄 upsert).
- [ ] T004 [P] `lib/realtime/institution-events.ts`: `subscribeNotifications({institutionId,onEvent,onSubscribed?})` 추가 — `notifications` INSERT를 `institution_id=eq.` 필터 구독(기존 `subscribeChairEvents` 패턴).

**Checkpoint**: 적재·조회·읽음·실시간 단위 준비 완료.

---

## Phase 3: US1 — 지나간 알림 다시보기 (P1) 🎯 MVP
**Goal**: 직원 대상 이벤트가 알림함에 쌓이고, 헤더 종에서 최신순으로 본다.
**Independent Test**: 상담 저장 → 종 클릭 → 알림 목록에 보임(quickstart 1).

- [ ] T005 [US1] `app/api/notifications/route.ts` 신규: `GET` — `getSessionUser` 인증, role(institution_members) 판정 → `getNotifications` → `{notifications, email}`.
- [ ] T006 [US1] `components/notifications/notification-bell.tsx` 신규: 종 버튼 + 드롭다운(목록: 타입아이콘·제목·본문·상대시간), mount 시 `GET /api/notifications` fetch, 외부클릭 닫기. 빈 상태 "알림이 없습니다". Carelog 팔레트.
- [ ] T007 [US1] `components/layout/header.tsx`: `NotificationBell`을 RefreshButton/SoundArmButton 옆에 배치.
- [ ] T008 [US1] `app/actions/chairs.ts` `saveChairRecord`: 기존 `sendPushToInstitution` 자리를 `sendNotification({type:'consultation_saved', title, body(요약·PII無), link:'/records', recipients:'all', institutionId, createdBy})`로 대체(내부서 푸시 발송 → 중복 방지).
- [ ] T009 [US1] `app/actions/consultations.ts` `saveConsultation`: 동일 패턴 `sendNotification`(link 환자상세/records). 환자용 `sendPushToPatient`는 불변.

**Checkpoint**: 알림이 쌓이고 종에서 열람됨(MVP 핵심).

---

## Phase 4: US2 — 읽음/안읽음 관리 (P1)
**Goal**: 미읽음 배지 + 클릭 읽음 + 토글 + 전체읽음 + PWA 배지.
**Independent Test**: 배지 카운트·읽음·전체읽음 동작(quickstart 2).

- [ ] T010 [US2] `app/api/notifications/[id]/read/route.ts` 신규: `POST`(markRead) / `PATCH {is_read:false}`(markUnread). `getSessionUser` 인증. (Next16 `params: Promise<{id}>` await)
- [ ] T011 [US2] `app/api/notifications/read-all/route.ts` 신규: `POST` → `markAllNotificationsRead`.
- [ ] T012 [US2] `components/notifications/notification-bell.tsx`: 미읽음 배지(9+) + 미읽음 강조/점, 클릭→낙관적 markRead+`POST /[id]/read`+링크 이동, ✓토글→`PATCH`, '전체 읽음'→`POST /read-all`, `navigator.setAppBadge`(가드).

**Checkpoint**: 읽음 관리·배지 완비(US1+US2 = 실사용 가능).

---

## Phase 5: US4 — 기관 격리·대상 필터·본인 읽음 (P1)
**Goal**: 다른 기관/비대상 알림 비노출, 본인 읽음만 반영.
**Independent Test**: 타기관·admins전용·타인읽음 분리(quickstart 4).

- [ ] T013 [US4] 검증·보강: `getNotifications` recipients 필터(all/admins=role admin/이메일==본인) + 기관 필터, RLS(T001) 동작 확인. 필요 시 lib 보강. (대부분 T001·T003에서 충족 — 회귀/경계 점검 중심)

**Checkpoint**: 격리·대상·본인읽음 보장.

---

## Phase 6: US3 — 새 알림 실시간 반영 (P2)
**Goal**: 새로고침 없이 즉시 반영 + 폴백.
**Independent Test**: 다른 직원 저장 시 수초 내 갱신(quickstart 3).

- [ ] T014 [US3] `components/notifications/notification-bell.tsx`: `subscribeNotifications`(institutionId) 구독 → 이벤트 시 재fetch + 30초 폴백 setInterval + 언마운트 정리. institutionId는 헤더/컨텍스트에서 전달.

**Checkpoint**: 모든 스토리 동작.

---

## Phase 7: Polish
- [ ] T015 [P] `docs/architecture.md`: 알림 흐름(sendNotification 적재+푸시, 2테이블, realtime, NotificationBell) 추가.
- [ ] T016 [P] `project_status.md`: 세션 기록.
- [ ] T017 `npm run build` 그린(TypeScript).
- [ ] T018 (배포 후 수동) quickstart 1~6 검증 + 회귀(헤더·실시간 토스트·상담 저장/푸시).

## 의존성
- Foundational(T001–T004) → 스토리.
- US1(T005–T009): T008/T009는 T003(sendNotification) 필요. T006/T007는 T005 필요.
- US2(T010–T012): T012는 T006(같은 파일) 뒤 순차.
- US3(T014): T012 뒤(같은 파일) 순차, T004 필요.
- US4(T013): T001·T003 기반 검증.
- notification-bell.tsx = T006→T012→T014 순차(같은 파일).
- MVP = US1+US2.
