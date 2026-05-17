# Tasks: Carelog 환자 앱

**Input**: Design documents from `/specs/005-patient-app/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (공유 인프라)

**Purpose**: DB 마이그레이션 + 타입 정의 — 모든 US의 전제조건

- [X] T001 `supabase/migrations/20260517000002_patient_auth_links.sql` 생성 — `patient_auth_links` 테이블(id uuid PK, auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, patient_account_id uuid NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE, provider text NOT NULL DEFAULT 'google', created_at timestamptz, UNIQUE(auth_user_id), UNIQUE(patient_account_id, provider)) + 인덱스 + RLS(SELECT: auth_user_id = auth.uid()) + `patient_push_subscriptions` 테이블(id uuid PK, patient_account_id uuid NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE, endpoint text NOT NULL, p256dh text NOT NULL, auth text NOT NULL, created_at timestamptz, UNIQUE(patient_account_id, endpoint)) + 인덱스 + RLS enabled (admin client 전용)
- [X] T002 `npx supabase db push`로 마이그레이션 적용 및 확인
- [X] T003 `supabase/schema.sql` 파일에 patient_auth_links, patient_push_subscriptions 테이블 스키마 동기화
- [X] T004 [P] `lib/types/database.ts` 수정 — `PatientAuthLinkRow`, `PatientPushSubscriptionRow` 타입 추가

**Checkpoint**: DB 준비 완료 — 이제 모든 US 작업 병렬 시작 가능

---

## Phase 2: Foundational (차단 전제조건)

**Purpose**: `getPatientSession()` 업데이트 — OTP 쿠키 + Supabase 세션 이중 인증 지원

**⚠️ CRITICAL**: US1~US4 모두 이 Phase 완료 필요

- [X] T005 `lib/patient-session.ts` 수정 — 기존 OTP 쿠키 체크 유지하되, OTP 세션 없을 때 Supabase 서버 클라이언트(`createServerSupabaseClient()`)로 `auth.uid()` 조회 → `patient_auth_links` SELECT WHERE `auth_user_id` = uid → 있으면 `{ patientAccountId }` 반환. 함수 시그니처: `getPatientSession(cookies: ReadonlyRequestCookies): Promise<PatientSessionData | null>` (시그니처 변경 없음, 내부에서 서버 클라이언트 생성)

**Checkpoint**: getPatientSession이 OTP 세션과 Supabase 세션 모두 지원 — US 구현 가능

---

## Phase 3: User Story 1 — SMS → Google 가입 완료 (Priority: P1) 🎯 MVP

**Goal**: SMS 링크 클릭 → OTP 인증 → 상담 내역 확인 → Google OAuth 가입 → /portal/records

**Independent Test**: /p/토큰 → OTP 입력 → /portal/signup-cta 이동 → Google 로그인 → /portal/records 표시 → DB에 patient_auth_links 행 생성 확인

### Implementation

- [X] T006 [P] [US1] `app/auth/patient-callback/route.ts` 생성 — GET 핸들러: `supabase.auth.exchangeCodeForSession(code)` → auth_user_id 획득 → `pending_patient_account_id` 쿠키 확인 → 있으면 `patient_auth_links` INSERT (중복 시 무시) + 쿠키 삭제 → `redirect('/portal/records')`. 없으면 `patient_auth_links` SELECT WHERE auth_user_id → 있으면 `/portal/records`, 없으면 `/portal/link-account` 리디렉션. OAuth 오류 시 `/portal/login?error=auth_failed`
- [X] T007 [P] [US1] `app/actions/patient-portal.ts` 수정 — `initiatePatientGoogleSignup(patientAccountId: string)` Server Action 추가: (1) 현재 patient_session_token으로 세션 확인 후 patientAccountId 검증 (2) `pending_patient_account_id` httpOnly 쿠키 설정 (5분 만료, Secure, SameSite=Lax) (3) Supabase 브라우저 클라이언트로 Google OAuth URL 생성이 어려우므로, 대신 redirect URL과 cookie 설정 후 `{ ok: true }` 반환하여 클라이언트가 `supabase.auth.signInWithOAuth()` 직접 호출하도록 함
- [X] T008 [US1] `app/(patient)/portal/signup-cta/page.tsx` 생성 — Server Component: (1) `getPatientSession(cookies())` 호출 → 없으면 `/portal/login` 리디렉션 (2) `invitation` searchParam으로 patient_invitations 조회 (admin client) → patient_id → 가장 최근 consultation 조회 (3) 상담 내역 미리보기 + `<PatientSignupCta patientAccountId={session.patientAccountId} />` 렌더링
- [X] T009 [US1] `components/patient/patient-signup-cta.tsx` 생성 — "use client" 컴포넌트: Supabase 브라우저 클라이언트로 `signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/patient-callback` } })` 호출 전 Server Action으로 `pending_patient_account_id` 쿠키 설정. Props: `{ patientAccountId: string }`. 버튼 클릭 → `setCookie` server action → Google OAuth 리디렉션
- [X] T010 [US1] `components/patient/patient-otp-form.tsx` 수정 — `verifyPatientOtp` 결과에서 `isNewAccount === true`이고 `invitationToken` 있으면 `router.push('/portal/signup-cta?invitation=' + invitationToken)`, 그 외 기존 `/portal/records` 유지
- [X] T011 [P] [US1] `app/(patient)/portal/link-account/page.tsx` 생성 — Google 로그인 후 patient_auth_links 없을 때 표시: "치과에서 받은 초대 링크로 먼저 가입을 완료해 주세요." + /portal/login 링크

**Checkpoint**: SMS 링크 → OTP → Google 가입 → /portal/records 전체 흐름 동작 확인

---

## Phase 4: User Story 2 — 환자 앱 전체 진료 이력 조회 (Priority: P2)

**Goal**: Google 로그인만으로 /portal/login → /portal/records 접근, 재방문 시 OTP 없이 즉시 접근

**Independent Test**: 시나리오 2 (quickstart.md) — /portal/login → Google 로그인 → /portal/records 표시 (OTP 입력 없음)

### Implementation

- [X] T012 [P] [US2] `app/(patient)/portal/login/page.tsx` 수정 — "Google로 로그인" 버튼 추가 (PatientGoogleLoginButton 클라이언트 컴포넌트 또는 인라인)
- [X] T013 [P] [US2] `components/patient/patient-login-form.tsx` 수정 — 하단에 구분선 + "Google 계정으로 로그인" 버튼 추가. 클릭 시 `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/patient-callback` } })`
- [X] T014 [US2] `app/(patient)/portal/records/page.tsx` 수정 — `getPatientSession(cookieStore)` 가 이제 Supabase 세션도 체크하므로 별도 수정 불필요. 단, 미인증 리디렉션 경로를 `/portal/login` 유지 확인. `getPatientAuthStatus()` 결과로 `isGoogleLinked` 상태 표시 고려 (선택)
- [X] T015 [US2] `app/actions/patient-portal.ts` 수정 — `getPatientAuthStatus()` Server Action 추가: 현재 세션(OTP 또는 Supabase)으로 patientAccountId 확인 + patient_auth_links SELECT WHERE patientAccountId AND provider='google' → isGoogleLinked 반환. 반환 타입: `{ ok: true; patientAccountId: string; isGoogleLinked: boolean } | { ok: false; message: string }`

**Checkpoint**: /portal/login에서 Google 로그인 버튼으로 /portal/records 접근 가능 확인

---

## Phase 5: User Story 3 — 새 상담 → 환자 푸시 알림 (Priority: P3)

**Goal**: 직원이 상담 저장 시 해당 환자(patient_push_subscriptions 등록된 경우) 기기로 푸시 알림 발송

**Independent Test**: 환자 기기에서 /portal/records 접속 → 알림 허용 → 직원이 상담 저장 → 5초 내 환자 기기에 푸시 도착

### Implementation

- [X] T016 [P] [US3] `app/actions/patient-portal.ts` 수정 — `subscribePatientPush(sub: PushSubscriptionJSON)` Server Action 추가: getPatientSession으로 patient_account_id 확인 → `patient_push_subscriptions` UPSERT (admin client). `unsubscribePatientPush(endpoint: string)` 추가: patient_account_id + endpoint로 DELETE. `sendPushToPatient(patientAccountId: string, payload: { title: string; body: string; url: string })` 추가: patient_push_subscriptions SELECT WHERE patient_account_id (admin client) → web-push.sendNotification 각 구독 호출 → 410/404 시 해당 행 삭제
- [X] T017 [US3] `app/actions/consultations.ts` 수정 — 기존 `sendPushToInstitution()` 호출 아래에 환자 push 추가: `patient_account_links` SELECT WHERE patient_id (admin client) → patient_account_id 획득 → `sendPushToPatient(patient_account_id, { title: '새 진료 기록', body: \`${patientName} — ${preview}\`, url: '/portal/records' })` fire-and-forget (`.catch(() => {})`)
- [X] T018 [US3] `components/patient/patient-push-banner.tsx` 생성 — "use client" 컴포넌트: `Notification.permission` 체크 → 'default'이면 "새 진료 기록 알림 받기" 배너 표시 → 허용 시 pushManager.subscribe → `subscribePatientPush()` Server Action 호출. 이미 허용/거부 시 배너 미표시. (push-notification-banner.tsx와 동일 패턴, patient용)
- [X] T019 [US3] `app/(patient)/portal/records/page.tsx` 수정 — 페이지 상단에 `<PatientPushBanner />` 추가

**Checkpoint**: 직원 상담 저장 → 환자 기기 푸시 알림 도착 → 탭 시 /portal/records 이동 확인

---

## Phase 6: User Story 4 — 이중 역할 (Priority: P4)

**Goal**: 직원 헤더에 "내 진료 기록" 메뉴 → Google OAuth → /portal/records 전환. /portal/records에서 "직원 화면으로" 복귀.

**Independent Test**: 직원 대시보드 헤더 "내 진료 기록" 클릭 → Google 로그인(이미 로그인 시 자동) → /portal/records 표시

### Implementation

- [X] T020 [US4] `components/layout/header.tsx` 수정 — 설정 링크 왼쪽에 "내 진료 기록" 링크 추가. 클릭 시 `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/patient-callback` } })` — 클라이언트 컴포넌트 분리 필요 시 `components/layout/patient-portal-link.tsx` 신설
- [X] T021 [US4] `app/(patient)/portal/records/page.tsx` 수정 — 헤더에 "직원 화면으로" 링크 추가. 단, 직원이 아닌 일반 환자에게는 표시 안 해도 무방 (링크가 있어도 직원 대시보드에서 권한 체크로 걸림). 단순하게 항상 표시 + href="/" 로 구현

**Checkpoint**: 직원 ↔ 환자 앱 전환 2초 이내 완료 확인

---

## Phase 7: Polish & 문서화

**Purpose**: 빌드 검증, 문서 업데이트, 배포

- [X] T022 [P] `project_status.md` 업데이트 — 환자 앱 기능(Google 가입, 재방문 로그인, 이중 역할, 환자 푸시) 완료 반영
- [X] T023 [P] `docs/architecture.md` 업데이트 — patient_auth_links, patient_push_subscriptions, /auth/patient-callback, /portal/signup-cta, /portal/link-account, PatientSignupCta, PatientPushBanner 추가
- [X] T024 [P] `docs/database.md` 업데이트 — patient_auth_links, patient_push_subscriptions 테이블 스키마 문서화
- [X] T025 `npm run build` 실행 — 빌드 오류 수정 (TypeScript strict 모드 준수)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작 가능
- **Foundational (Phase 2)**: Phase 1 완료 후 — T005는 T001~T002 완료 필요
- **US1 (Phase 3)**: Phase 2 완료 후 시작
- **US2 (Phase 4)**: Phase 2 완료 후 시작 (US1과 병렬 가능)
- **US3 (Phase 5)**: Phase 1 완료 필수 (patient_push_subscriptions 테이블 필요)
- **US4 (Phase 6)**: Phase 2 완료 후 시작
- **Polish (Phase 7)**: 원하는 US 모두 완료 후

### Parallel Opportunities

- T004, T006, T007, T011 병렬 가능 (서로 다른 파일)
- T012, T013 병렬 가능 (US2 login 관련)
- T016, T018, T019 병렬 가능 (US3 push 관련)
- T022, T023, T024 (문서) 병렬 가능

---

## Implementation Strategy

### MVP First (US1만)

1. Phase 1: Setup (T001~T004)
2. Phase 2: Foundational (T005)
3. Phase 3: US1 Google 가입 (T006~T011)
4. **STOP and VALIDATE**: SMS → OTP → Google 가입 → /portal/records 전체 흐름 테스트

### Full Feature

1. MVP 완료 후
2. Phase 4: US2 재방문 로그인 (T012~T015)
3. Phase 5: US3 환자 푸시 (T016~T019)
4. Phase 6: US4 이중 역할 (T020~T021)
5. Phase 7: Polish (T022~T025)

---

## Notes

- `supabase.auth.signInWithOAuth()`는 브라우저 클라이언트에서만 동작 — Server Action에서 호출 불가. 클라이언트 컴포넌트에서 직접 호출.
- `pending_patient_account_id` 쿠키 설정은 Server Action에서 처리 후 클라이언트가 Google OAuth 리디렉션
- `patient_push_subscriptions` RLS는 admin client 전용으로 설정 — 클라이언트 직접 접근 차단
- `app/auth/patient-callback/route.ts`에서 admin client로 patient_auth_links INSERT 처리 (RLS 우회)
- `sendPushToPatient()`는 fire-and-forget — consultations.ts에서 await 없이 호출, try-catch로 래핑
