# Tasks: 직원 로그인 및 의료기관 계정 구조

**Input**: `specs/001-staff-auth-institution/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

---

## Phase 1: Setup (공유 인프라)

**Purpose**: 환경변수, 미들웨어, 라우트 그룹 기반 세팅

- [ ] T001 `SUPABASE_SERVICE_ROLE_KEY` 환경변수를 Vercel 대시보드에 추가 (Settings → Environment Variables)
- [ ] T002 로컬 `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 추가 (vercel env pull로 갱신)
- [ ] T003 [P] `app/(auth)/` Route Group 디렉터리 생성 (login, signup, invite/[token] 하위 포함)
- [ ] T004 [P] `app/(dashboard)/` Route Group 디렉터리 생성
- [ ] T005 기존 `app/page.tsx` → `app/(dashboard)/page.tsx` 이동
- [ ] T006 기존 `app/patients/` → `app/(dashboard)/patients/` 이동
- [ ] T007 기존 `app/view/` → `app/(dashboard)/view/` 이동

---

## Phase 2: Foundational (모든 User Story의 전제)

**Purpose**: DB 마이그레이션, Supabase Auth 미들웨어, lib 유틸 — 완료 전 User Story 구현 불가

**⚠️ CRITICAL**: Supabase SQL Editor에서 data-model.md의 마이그레이션 SQL을 단계별로 실행 후 진행

- [ ] T008 Supabase SQL Editor에서 Step 1~2 실행: `institutions`, `institution_members`, `institution_invitations` 테이블 생성
- [ ] T009 Supabase SQL Editor에서 Step 3~4 실행: `patient`, `consultation` 테이블에 `institution_id` 컬럼 추가 + 시드 기관 INSERT + 기존 데이터 귀속 UPDATE
- [ ] T010 Supabase SQL Editor에서 Step 5 실행: `institution_id` NOT NULL 제약 추가 (Step 4 데이터 확인 후)
- [ ] T011 Supabase SQL Editor에서 Step 6 실행: `get_my_institution_id()` 함수 생성 + RLS 정책 교체
- [ ] T012 [P] `lib/supabase/middleware.ts` 생성 — `updateSession()` 헬퍼 (Supabase 공식 패턴)
- [ ] T013 [P] `lib/auth/institution.ts` 생성 — `getMyInstitutionId()`, `getMyInstitution()` React cache 함수
- [ ] T014 `app/middleware.ts` 생성 — 세션 갱신 + 인증 필요 경로 보호 (`/login` 리다이렉트)
- [ ] T015 `app/(dashboard)/layout.tsx` 생성 — 미인증 시 `/login` 리다이렉트 + 기관명 헤더 포함
- [ ] T016 `lib/types/database.ts` 업데이트 — `InstitutionRow`, `InstitutionMemberRow`, `InstitutionInvitationRow` 타입 추가 + `PatientRow`에 `institution_id` 추가

**Checkpoint**: 미들웨어 동작 확인 — 미인증 상태로 `/` 접근 시 `/login` 리다이렉트되어야 함

---

## Phase 3: User Story 1 — 의료기관 최초 등록 (Priority: P1) 🎯 MVP

**Goal**: 원장이 회원가입 + 기관 등록 후 대시보드 진입, 기존 환자 데이터 조회

**Independent Test**: `/signup` → 이메일+비밀번호+기관명 입력 → 제출 → 대시보드에서 기관명 표시 + 기존 환자 검색 정상 동작

### Implementation

- [ ] T017 [US1] `app/actions/auth.ts` 생성 — `signUp()`, `signIn()`, `signOut()` Server Actions (contracts/server-actions.md 참고)
- [ ] T018 [US1] `app/actions/institutions.ts` 생성 — `getMyInstitution()` Server Action
- [ ] T019 [P] [US1] `app/actions/patients.ts` 수정 — 모든 쿼리에 `.eq('institution_id', institutionId)` 필터 추가 (getMyInstitutionId 호출)
- [ ] T020 [P] [US1] `app/actions/consultations.ts` 수정 — 모든 쿼리에 institution_id 필터 추가
- [ ] T021 [P] [US1] `components/auth/signup-form.tsx` 생성 — 이메일, 비밀번호, 기관명 입력 폼
- [ ] T022 [P] [US1] `app/(auth)/signup/page.tsx` 생성 — SignupForm 렌더
- [ ] T023 [P] [US1] `components/auth/login-form.tsx` 생성 — 이메일, 비밀번호 입력 폼
- [ ] T024 [P] [US1] `app/(auth)/login/page.tsx` 생성 — LoginForm 렌더
- [ ] T025 [US1] `components/layout/header.tsx` 생성 — 기관명 표시 + 로그아웃 버튼
- [ ] T026 [US1] `app/(dashboard)/layout.tsx` 업데이트 — Header 컴포넌트 포함
- [ ] T027 [US1] `app/actions/patients.ts`의 `createPatient`, `updatePatient` 수정 — `institution_id` INSERT/PATCH에 포함

**Checkpoint**: 원장 계정으로 회원가입 → 로그인 → 기존 환자 데이터 조회 → 로그아웃 흐름 완전 동작

---

## Phase 4: User Story 2 — 직원 초대 및 역할 관리 (Priority: P2)

**Goal**: 원장이 직원을 이메일로 초대, 직원이 수락 후 로그인하여 동일 기관 데이터 접근

**Independent Test**: 원장 로그인 → 직원 이메일 초대 → 직원이 초대 메일 수신 → 링크 클릭 → 비밀번호 설정 → 로그인 → 환자 목록 접근 가능

### Implementation

- [ ] T028 [US2] `app/actions/institutions.ts` 업데이트 — `inviteStaff()`, `acceptInvitation()` Server Actions 추가
- [ ] T029 [US2] `lib/supabase/admin.ts` 생성 — `SUPABASE_SERVICE_ROLE_KEY` 기반 admin 클라이언트 (서버 전용)
- [ ] T030 [P] [US2] `components/auth/invite-form.tsx` 생성 — 토큰 검증 + 비밀번호 설정 폼
- [ ] T031 [P] [US2] `app/(auth)/invite/[token]/page.tsx` 생성 — InviteForm 렌더 + 토큰 유효성 사전 확인
- [ ] T032 [P] [US2] `components/institution/invite-staff-form.tsx` 생성 — 직원 이메일 + 역할 선택 폼
- [ ] T033 [US2] `app/(dashboard)/settings/page.tsx` 생성 — 직원 초대 폼 + 현재 멤버 목록 표시

**Checkpoint**: 직원 초대 → 이메일 수신 → 수락 → 직원 계정 로그인 → 환자 데이터 접근, 타 기관 데이터 미노출 확인

---

## Phase 5: User Story 3 — 기존 데이터 기관 귀속 검증 (Priority: P1)

**Goal**: 마이그레이션 후 기존 환자·상담 데이터가 손실 없이 기관 계정으로 조회됨

**Independent Test**: 기관 계정 로그인 → 환자 목록에 마이그레이션 전 전체 환자 표시 → 개별 환자 클릭 → 상담 이력 정상 표시

> **Note**: T008~T011(DB 마이그레이션)이 완료되면 이 User Story는 자동으로 충족됨.
> 아래 태스크는 데이터 정합성 최종 검증을 위한 것.

- [ ] T034 [US3] Supabase Table Editor에서 `patient` 테이블 전체 레코드의 `institution_id` 값 확인 (NULL 없어야 함)
- [ ] T035 [US3] Supabase Table Editor에서 `consultation` 테이블 전체 레코드의 `institution_id` 값 확인
- [ ] T036 [US3] 기관 계정 로그인 후 환자 전체 목록 조회 — 마이그레이션 전 환자 수와 동일한지 확인

**Checkpoint**: 데이터 손실률 0% 확인

---

## Phase 6: Polish & 마무리

- [ ] T037 [P] `docs/architecture.md` 업데이트 — Route Groups, middleware, auth 흐름 추가
- [ ] T038 [P] `docs/database.md` 업데이트 — 신규 테이블 3개 + RLS 정책 변경 내용 반영
- [ ] T039 [P] `supabase/schema.sql` 업데이트 — 마이그레이션 SQL 전체 반영
- [ ] T040 `supabase/migrations/001_staff_auth_institution.sql` 생성 — 마이그레이션 SQL 파일로 분리 보관
- [ ] T041 `project_status.md` 업데이트 — Phase 1 완료 표시, Phase 2 준비 상태 기록
- [ ] T042 quickstart.md의 검증 시나리오 5개 직접 실행하여 전체 통과 확인
- [ ] T043 `npm run build` 실행 — 타입 에러, 빌드 에러 없음 확인
- [ ] T044 GitHub push + Vercel 배포 확인

---

## 의존성 & 실행 순서

### Phase 의존성

- **Phase 1** (Setup): 즉시 시작 가능
- **Phase 2** (Foundational): Phase 1 완료 후 — **모든 User Story 블로킹**
- **Phase 3** (US1): Phase 2 완료 후 시작, Phase 4보다 먼저
- **Phase 4** (US2): Phase 3 완료 후 시작 (inviteStaff는 기관 계정 필요)
- **Phase 5** (US3): Phase 2 DB 마이그레이션과 동시 검증
- **Phase 6** (Polish): 전체 완료 후

### 병렬 실행 기회

```
Phase 1: T003, T004 동시 실행 가능
Phase 2: T012, T013 동시 실행 가능
Phase 3: T019+T020 동시, T021+T022+T023+T024 동시
Phase 4: T030+T031+T032 동시
Phase 6: T037+T038+T039 동시
```

---

## 구현 전략

### MVP (Phase 1~3만, US1 완료)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1
2. 검증: 원장 회원가입 → 로그인 → 환자 데이터 조회 → 로그아웃
3. Vercel 배포 → 두 번째 클리닉 온보딩 가능한 상태

### Full Phase 1 (US2까지)

MVP 완료 후 Phase 4(US2) 추가 → 직원 초대 시스템 활성화

---

## 총 태스크 수

| Phase | 태스크 수 | 비고 |
|---|---|---|
| Phase 1 Setup | 7 | 즉시 시작 |
| Phase 2 Foundational | 9 | DB 실행 포함 |
| Phase 3 US1 | 11 | MVP 핵심 |
| Phase 4 US2 | 6 | 직원 초대 |
| Phase 5 US3 | 3 | 검증 |
| Phase 6 Polish | 8 | 마무리 |
| **합계** | **44** | |
