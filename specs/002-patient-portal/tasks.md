# Tasks: 환자 포털

**Input**: `specs/002-patient-portal/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

---

## Phase 1: Setup (공유 인프라)

**Purpose**: Solapi SDK, 환경변수, 마이그레이션 파일, 디렉터리 구조 준비

- [x] T001 `solapi` 패키지 설치 (`npm install solapi`) — 패키지명 @solapi/node-sdk 아님, solapi v6.0.1 설치
- [x] T002 `.env.local`에 `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_PHONE` 추가 (Vercel 등록은 실제 키 발급 후 필요)
- [x] T003 [P] `supabase/migrations/20260510000001_patient_portal.sql` 생성 — data-model.md의 5개 테이블 DDL + RLS 정책 + 인덱스 전체 포함
- [x] T004 [P] `app/(patient)/` 라우트 그룹 디렉터리 구조 생성 — `p/[token]/`, `portal/login/`, `portal/verify/`, `portal/records/` 하위 폴더 및 page.tsx 파일 생성

---

## Phase 2: Foundational (모든 User Story의 전제)

**Purpose**: DB 스키마, 공유 유틸, 미들웨어 확장 — 완료 전 User Story 구현 불가

**⚠️ CRITICAL**: DB 마이그레이션 실행 후 User Story 구현 시작

- [x] T005 Supabase Management API 또는 SQL Editor에서 `supabase/migrations/20260510000001_patient_portal.sql` 실행하여 5개 테이블 생성 확인 ← 2026-05-10 사용자가 SQL Editor에서 직접 실행 완료
- [x] T006 [P] `lib/types/database.ts` 업데이트 — `PatientInvitationRow`, `PatientAccountRow`, `PatientOtpRow`, `PatientSessionRow`, `PatientAccountLinkRow` 타입 추가
- [x] T007 [P] `lib/sms/solapi.ts` 생성 — `sendSms(to: string, text: string)` 함수 구현, `solapi` SDK 사용
- [x] T008 `lib/patient-session.ts` 생성 — `getPatientSession(cookies)` 함수 구현
- [x] T009 `lib/supabase/middleware.ts` 수정 — `/p/`, `/portal/login`, `/portal/verify` 공개 경로 추가

**Checkpoint**: `npm run build` 통과 + DB에 5개 신규 테이블 존재 확인

---

## Phase 3: User Story 1 — 직원의 SMS 초대 발송 (Priority: P1) 🎯 MVP 시작

**Goal**: 직원이 환자 상세 페이지에서 케어로그 가입 초대 문자를 환자에게 발송한다

**Independent Test**: 직원 로그인 → 환자 상세 페이지 → "상담 공유" 버튼 클릭 → 전화번호 확인 + 동의 체크 → 전송 → 해당 번호로 SMS 수신 확인

- [x] T010 [P] [US1] `app/actions/patient-portal.ts` 생성 — `sendPatientInvitation` Server Action 구현
- [x] T011 [P] [US1] `components/patient/send-invitation-button.tsx` 생성 — 모달 + 동의 체크 + 발송
- [x] T012 [US1] `app/(dashboard)/patients/[patientId]/page.tsx` 수정 — `<SendInvitationButton>` 추가

**Checkpoint**: 직원 로그인 → 환자 상세 → "상담 공유" 클릭 → SMS 수신 확인 (quickstart 시나리오 1)

---

## Phase 4: User Story 2 — 환자 최초 가입 (Priority: P1)

**Goal**: 환자가 SMS 링크를 클릭하고 주민번호 + 전화번호 OTP로 케어로그에 가입한다

**Independent Test**: 초대 링크 클릭 → 주민번호+전화번호 입력 → OTP 인증 → 계정 생성 → `/portal/records` 진입 + 상담 내역 표시

- [x] T013 [P] [US2] `app/actions/patient-portal.ts` 업데이트 — `requestPatientOtp` 추가 (rrnHash 반환 포함)
- [x] T014 [P] [US2] `app/actions/patient-portal.ts` 업데이트 — `verifyPatientOtp` 추가
- [x] T015 [P] [US2] `components/patient/patient-login-form.tsx` 생성
- [x] T016 [P] [US2] `components/patient/patient-otp-form.tsx` 생성
- [x] T017 [US2] `app/(patient)/p/[token]/page.tsx` 구현
- [x] T018 [US2] `app/(patient)/portal/login/page.tsx` 구현
- [x] T019 [US2] `app/(patient)/portal/verify/page.tsx` 구현

**Checkpoint**: 링크 클릭 → 주민번호+전화번호 입력 → OTP 인증 → 계정 생성 → 상담 내역 화면 이동 (quickstart 시나리오 2, 3)

---

## Phase 5: User Story 3 — 환자 상담 내역 조회 (Priority: P1)

**Goal**: 로그인한 환자가 모든 연결된 치과의 상담 내역을 통합 조회한다

**Independent Test**: 환자 로그인 후 `/portal/records` 접속 → 연결된 모든 치과 상담 내역 최신순 표시 → 항목 클릭 시 내용+사진+처방메모 상세 조회

- [x] T020 [P] [US3] `app/actions/patient-portal.ts` 업데이트 — `getPatientRecords()` 추가
- [x] T021 [P] [US3] `components/patient/patient-records-list.tsx` 생성
- [x] T022 [US3] `app/(patient)/layout.tsx` 생성 (pass-through; 세션 체크는 records page에서 직접)
- [x] T023 [US3] `app/(patient)/portal/records/page.tsx` 구현 — 세션 체크 + `<PatientRecordsList>` 렌더

**Checkpoint**: 환자 로그인 → `/portal/records` → 상담 내역 표시 + 기관명 레이블 확인 (quickstart 시나리오 2, 7)

---

## Phase 6: User Story 4 — 재방문 로그인 + 로그아웃 (Priority: P2)

**Goal**: 기존 환자가 초대 링크 없이 주민번호+OTP로 로그인하고, 세션 종료할 수 있다

**Independent Test**: `/portal/login` → 주민번호+전화번호 → OTP → 전체 상담 내역 표시 / 로그아웃 → `/portal/login` 리다이렉트

> **Note**: `/portal/login`과 OTP 흐름은 Phase 4(US2)에서 이미 구현됨 — `invitation_token` 없이 동작. 이 Phase는 로그아웃과 엣지케이스 처리만 추가.

- [x] T024 [P] [US4] `app/actions/patient-portal.ts` 업데이트 — `patientLogout` 추가
- [x] T025 [US4] `app/(patient)/portal/records/page.tsx` 수정 — 로그아웃 버튼 추가

**Checkpoint**: 재방문 로그인 + 로그아웃 전체 흐름 동작 (quickstart 시나리오 4, 6)

---

## Phase 7: Polish & 마무리

- [ ] T026 quickstart.md 7개 시나리오 수동 실행 — 전체 통과 확인 (시나리오 5: 만료 링크, 6: OTP 잠금 포함) ← Solapi 실제 키 설정 후 진행 필요
- [x] T027 [P] `docs/architecture.md` 업데이트 — `(patient)` 라우트 그룹, `lib/sms/solapi.ts`, `lib/patient-session.ts` 추가
- [x] T028 [P] `docs/database.md` 업데이트 — 5개 신규 테이블 스키마 추가
- [x] T029 [P] `supabase/schema.sql` 업데이트 — 마이그레이션 SQL 전체 반영
- [x] T030 [P] `project_status.md` 업데이트 — 환자 포털 기능 완료 표시
- [x] T031 `npm run build` 실행 — 타입 에러, 빌드 에러 없음 확인 후 `git push origin main`

---

## 의존성 & 실행 순서

### Phase 의존성

- **Phase 1** (Setup): 즉시 시작 가능
- **Phase 2** (Foundational): Phase 1 완료 후 — **T005 DB 마이그레이션이 모든 US 블로킹**
- **Phase 3** (US1): Phase 2 완료 후
- **Phase 4** (US2): Phase 2 완료 후 (US1과 병렬 가능)
- **Phase 5** (US3): Phase 4 완료 후 (세션 쿠키 의존)
- **Phase 6** (US4): Phase 4 완료 후 (로그인 흐름 재사용)
- **Phase 7** (Polish): Phase 3~6 완료 후

### 같은 파일 내 순서 주의

`app/actions/patient-portal.ts`는 T010 → T013 → T014 → T020 → T024 순서로 함수가 추가됨.  
각 태스크는 해당 함수만 추가하며 기존 함수를 덮어쓰지 않도록 주의.

### 병렬 실행 기회

```
Phase 1: T003, T004 동시 실행
Phase 2: T006, T007 동시 실행
Phase 3: T010, T011 동시 실행
Phase 4: T013, T014, T015, T016 동시 실행
Phase 5: T020, T021 동시 실행
Phase 7: T027, T028, T029, T030 동시 실행
```

---

## 구현 전략

### MVP (Phase 1~5: US1+US2+US3 완료)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1 (직원 SMS 발송)
3. Phase 4 US2 (환자 가입)
4. Phase 5 US3 (상담 내역 조회)
5. **STOP**: quickstart 시나리오 1~3 + 7 검증 → 배포
6. 실제 환자 사용 가능한 최소 제품

### Full (Phase 6 US4 추가)

MVP 배포 후 Phase 6(로그아웃) 추가 → Phase 7 문서화 + 배포

---

## 총 태스크 수

| Phase | 태스크 수 | 비고 |
|---|---|---|
| Phase 1 Setup | 4 | 즉시 시작 |
| Phase 2 Foundational | 5 | DB 마이그레이션 포함 |
| Phase 3 US1 | 3 | MVP 시작 |
| Phase 4 US2 | 7 | 핵심 가입 흐름 |
| Phase 5 US3 | 4 | 상담 조회 |
| Phase 6 US4 | 2 | 재방문+로그아웃 |
| Phase 7 Polish | 6 | 문서+검증 |
| **합계** | **31** | |
