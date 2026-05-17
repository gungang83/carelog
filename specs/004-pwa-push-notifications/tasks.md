# Tasks: Carelog PWA + 푸시 알림

**Input**: Design documents from `/specs/004-pwa-push-notifications/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (공유 인프라)

**Purpose**: 패키지 설치 및 환경 변수 준비

- [X] T001 `web-push` 패키지 설치 (`npm install web-push @types/web-push`)
- [X] T002 VAPID 키쌍 생성 후 `.env.local`에 추가 (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
- [X] T003 Vercel에 VAPID 환경 변수 4개 추가 (`npx vercel env add` for production + development)

---

## Phase 2: Foundational (차단 전제조건)

**Purpose**: push_subscriptions DB 테이블 — 모든 푸시 기능의 전제조건

**⚠️ CRITICAL**: 이 Phase 완료 전 US3 작업 불가

- [X] T004 Supabase 마이그레이션 파일 생성 `supabase/migrations/20260517000001_push_subscriptions.sql` — `push_subscriptions` 테이블(id uuid PK, user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, institution_id uuid NOT NULL, endpoint text UNIQUE per user, p256dh text, auth text, created_at timestamptz) + RLS policies(SELECT/INSERT/DELETE: user_id=auth.uid()) + institution_id 인덱스
- [X] T005 `npx supabase db push`로 마이그레이션 적용 및 확인
- [X] T006 `supabase/schema.sql` 파일에 push_subscriptions 테이블 스키마 동기화

**Checkpoint**: DB 준비 완료 — 이제 US3 푸시 기능 작업 가능

---

## Phase 3: User Story 1 — PWA 홈 화면 추가 (Priority: P1) 🎯 MVP

**Goal**: 모바일 브라우저에서 Carelog를 홈 화면에 추가하고 앱처럼 실행

**Independent Test**: Chrome 모바일에서 "홈 화면에 추가" 완료 → 전체 화면 실행 확인

### Implementation

- [X] T007 [P] [US1] PWA 아이콘 생성 — `public/icons/icon-192.png`, `public/icons/icon-512.png` (하늘색 sky-600 배경, 흰색 "C" 로고, 각각 192×192, 512×512 PNG)
- [X] T008 [P] [US1] `app/manifest.ts` 생성 — Next.js 16 방식 Web App Manifest (name: "Carelog", short_name: "Carelog", start_url: "/", display: "standalone", theme_color: "#0284c7", background_color: "#ffffff", icons 배열 포함)
- [X] T009 [US1] `public/sw.js` 생성 — Service Worker: `push` 이벤트(JSON 파싱 → showNotification), `notificationclick` 이벤트(clients.openWindow(data.url)), fetch 이벤트(네트워크 우선 기본 캐시)
- [X] T010 [US1] `app/layout.tsx` 수정 — Service Worker 등록 스크립트 추가(`navigator.serviceWorker.register('/sw.js')`), Apple PWA 메타태그 추가(`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`)
- [X] T011 [US1] `app/layout.tsx` 수정 — `<link rel="manifest" href="/manifest.webmanifest">` 및 `<meta name="theme-color" content="#0284c7">` 추가 (Next.js manifest.ts가 자동 처리 안 하는 경우 대비)

**Checkpoint**: 모바일 Chrome에서 홈 화면 추가 가능, 전체 화면 실행 확인

---

## Phase 4: User Story 2 — 항시 로그인 유지 (Priority: P2)

**Goal**: 앱 재실행 시 로그인 상태 자동 복원, 세션 만료 시 자동 갱신

**Independent Test**: 로그인 후 앱 종료 → 재실행 → 로그인 화면 없이 메인 화면 표시

### Implementation

- [X] T012 [US2] `middleware.ts` 확인 및 수정 — `@supabase/ssr`의 `updateSession()` 호출이 모든 경로에서 실행되는지 확인, 누락 시 추가하여 쿠키 기반 세션 자동 갱신 보장
- [X] T013 [US2] `components/layout/session-refresher.tsx` 생성 — `"use client"` 컴포넌트: `supabase.auth.onAuthStateChange` 리스너로 `SIGNED_OUT` 이벤트 감지 시 `/login` 리디렉션, `TOKEN_REFRESHED` 이벤트 로깅
- [X] T014 [US2] `app/(dashboard)/layout.tsx` 수정 — `<SessionRefresher>` 컴포넌트 포함하여 로그인 상태 지속 보장

**Checkpoint**: 24시간 방치 후 재실행 시 로그인 화면 없이 메인 화면 표시

---

## Phase 5: User Story 3 — 푸시 알림 수신 (Priority: P3)

**Goal**: 상담 기록 저장 시 기관 직원 전체 기기로 Web Push 알림 발송

**Independent Test**: 상담 저장 → 5초 내 등록 기기에 푸시 알림 도착 → 탭 시 해당 기록 이동

### Implementation

- [X] T015 [US3] `app/actions/push.ts` 생성 — Server Actions: `subscribePush(sub: PushSubscriptionJSON)` (DB INSERT), `unsubscribePush(endpoint: string)` (DB DELETE), `sendPushToInstitution(institutionId: string, payload: PushPayload)` (VAPID 서명 후 web-push.sendNotification 호출, 410 Gone 구독 자동 삭제)
- [X] T016 [US3] `app/actions/consultations.ts` 수정 — `saveConsultation()` Server Action 내 상담 저장 성공 후 `sendPushToInstitution()` 비동기 호출 추가 (await 없이 fire-and-forget, try-catch로 감싸 실패 시 상담 저장에 영향 없도록)
- [X] T017 [US3] `components/push-notification-banner.tsx` 생성 — `"use client"` 컴포넌트: 알림 권한 상태 감지(`Notification.permission`), 미허용 시 "알림 받기" 배너 표시, 버튼 클릭 시 `Notification.requestPermission()` → 허용 시 `subscribePush()` 호출, 이미 허용/거부된 경우 배너 미표시
- [X] T018 [US3] `app/(dashboard)/page.tsx` 수정 — 홈 화면 최상단에 `<PushNotificationBanner>` 추가
- [X] T019 [US3] `app/(dashboard)/settings/page.tsx` 수정 — 알림 구독 관리 섹션 추가: 현재 구독 상태 표시, "알림 해제" 버튼(클릭 시 `unsubscribePush()` 호출)

**Checkpoint**: 상담 저장 → 등록 기기에 푸시 알림 도착 → 탭 시 환자 상담 기록 화면 이동

---

## Phase 6: User Story 4 — 헤더 고정 + 새로고침 버튼 (Priority: P4)

**Goal**: 헤더 항상 상단 고정, 새로고침 버튼으로 최신 데이터 반영

**Independent Test**: 긴 목록 스크롤 후 헤더 고정 확인, 새로고침 버튼 탭 후 최신 데이터 표시

### Implementation

- [X] T020 [US4] `components/layout/refresh-button.tsx` 생성 — `"use client"` 컴포넌트: `useRouter().refresh()` 호출, 로딩 상태(`useTransition`) 표시, 아이콘은 ↻ 또는 SVG rotate icon
- [X] T021 [US4] `components/layout/header.tsx` 수정 — `<RefreshButton>` 추가 (로그아웃 버튼 왼쪽), 기존 `sticky top-0 z-40` 클래스 유지 확인

**Checkpoint**: 헤더 고정 동작 확인, 새로고침 버튼으로 RSC 데이터 갱신 확인

---

## Phase 7: User Story 5 — 푸터 브랜딩 (Priority: P5)

**Goal**: 모든 페이지 하단에 "SUWANT holdings Inc." 푸터 표시

**Independent Test**: 모든 주요 페이지(홈, 환자 목록, 설정) 하단 스크롤 → 푸터 표시 확인

### Implementation

- [X] T022 [US5] `components/footer.tsx` 생성 — 정적 컴포넌트: "SUWANT holdings Inc." 텍스트, 현재 연도, Carelog 버전 표시 (작은 폰트, slate-400 색상)
- [X] T023 [US5] `app/(dashboard)/layout.tsx` 수정 — `<main>` 아래 `<Footer>` 추가 (flex-col 레이아웃 유지)

**Checkpoint**: 모든 주요 페이지에서 푸터 표시 확인

---

## Phase 8: Polish & 문서화

**Purpose**: 빌드 검증, 문서 업데이트, 배포

- [X] T024 [P] `project_status.md` 업데이트 — PWA 변환 완료, 푸시 알림, 새로고침 버튼, 푸터 기능 반영
- [X] T025 [P] `docs/architecture.md` 업데이트 — Service Worker, push_subscriptions, 새 컴포넌트(RefreshButton, PushNotificationBanner, Footer, SessionRefresher) 추가
- [X] T026 [P] `docs/database.md` 업데이트 — push_subscriptions 테이블 스키마 문서화
- [X] T027 `npm run build` 실행 — 빌드 오류 수정 (TypeScript strict 모드 준수)
- [ ] T028 Vercel VAPID 환경 변수 확인 (`vercel env ls`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작 가능
- **Foundational (Phase 2)**: Phase 1 완료 후 — US3 차단
- **US1 (Phase 3)**: Phase 1 완료 후 즉시 시작 가능 (DB 불필요)
- **US2 (Phase 4)**: Phase 1 완료 후 시작 가능 (DB 불필요)
- **US3 (Phase 5)**: Phase 2 완료 필수 (push_subscriptions 테이블 필요)
- **US4 (Phase 6)**: 독립적, 어느 시점에서든 시작 가능
- **US5 (Phase 7)**: 독립적, 어느 시점에서든 시작 가능
- **Polish (Phase 8)**: 모든 원하는 User Story 완료 후

### Parallel Opportunities

- T007, T008 (US1 아이콘·manifest) 병렬 가능
- Phase 1 완료 후 US1·US2·US4·US5 모두 병렬 시작 가능
- T024·T025·T026 (문서 업데이트) 병렬 가능

---

## Parallel Example: User Story 1

```bash
# 동시 실행 가능:
Task T007: public/icons/icon-192.png, icon-512.png 생성
Task T008: app/manifest.ts 생성
```

---

## Implementation Strategy

### MVP First (US1 + US4 + US5 Only)

1. Phase 1: Setup (T001–T003)
2. Phase 3: US1 PWA (T007–T011) — 홈 화면 추가
3. Phase 6: US4 헤더 새로고침 (T020–T021)
4. Phase 7: US5 푸터 (T022–T023)
5. **STOP and VALIDATE**: PWA 설치, 헤더 고정, 푸터 확인

### Full Feature

1. MVP 완료 후
2. Phase 2: DB 마이그레이션 (T004–T006)
3. Phase 4: US2 항시 로그인 (T012–T014)
4. Phase 5: US3 푸시 알림 (T015–T019)
5. Phase 8: Polish (T024–T028)

---

## Notes

- `web-push` 패키지는 Node.js 환경(Server Action)에서만 사용 — 클라이언트 번들에 포함되지 않도록 주의
- Service Worker는 `public/sw.js` 위치 필수 (Next.js는 `public/`을 정적으로 서빙)
- VAPID 키는 `.env.local`과 Vercel 환경 변수 모두에 설정 필요
- iOS Safari: Web Push는 홈 화면에 추가된 PWA에서만 동작 (iOS 16.4+)
- `sendPushToInstitution`은 Supabase service role key로 RLS 우회하여 기관 전체 구독 조회
