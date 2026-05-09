# Tasks: 직원 로그인 및 의료기관 계정 구조

**Input**: `specs/001-staff-auth-institution/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

---

## Phase 1: Setup (공유 인프라) ✅ 완료

**Purpose**: 환경변수, 미들웨어, 라우트 그룹 기반 세팅

- [x] T001 `SUPABASE_SERVICE_ROLE_KEY` 환경변수를 Vercel에 추가 (vercel env add)
- [x] T002 로컬 `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 추가 (vercel env pull로 갱신)
- [x] T003 [P] `app/(auth)/` Route Group 디렉터리 생성 (login, signup, invite/[token] 하위 포함)
- [x] T004 [P] `app/(dashboard)/` Route Group 디렉터리 생성
- [x] T005 기존 `app/page.tsx` → `app/(dashboard)/page.tsx` 이동
- [x] T006 기존 `app/patients/` → `app/(dashboard)/patients/` 이동
- [x] T007 기존 `app/view/` → `app/(dashboard)/view/` 이동

---

## Phase 2: Foundational (모든 User Story의 전제) ✅ 완료

**Purpose**: DB 마이그레이션, Supabase Auth 미들웨어, lib 유틸

- [x] T008 DB 마이그레이션: `institutions`, `institution_members`, `institution_invitations` 테이블 생성
- [x] T009 DB 마이그레이션: `patient`, `consultation`에 `institution_id` 컬럼 추가 + 시드 기관 INSERT + 기존 데이터 귀속
- [x] T010 DB 마이그레이션: `institution_id` NOT NULL 제약 추가
- [x] T011 DB 마이그레이션: `get_my_institution_id()` 함수 생성 + RLS 정책 교체
- [x] T012 [P] `lib/supabase/middleware.ts` 생성 — `updateSession()` 헬퍼
- [x] T013 [P] `lib/auth/institution.ts` 생성 — `getMyInstitutionId()`, `getMyInstitution()` React cache
- [x] T014 `proxy.ts` 생성 — Next.js 16 미들웨어 (`middleware.ts` 대체, `proxy` 함수 export)
- [x] T015 `app/(dashboard)/layout.tsx` 생성 — 미인증 시 `/login` 리다이렉트 + 기관명 헤더
- [x] T016 `lib/types/database.ts` 업데이트 — `InstitutionRow`, `InstitutionMemberRow`, `InstitutionInvitationRow` 타입 추가

**Checkpoint**: ✅ 미들웨어 동작 — 미인증 상태로 `/` 접근 시 `/login` 리다이렉트

---

## Phase 3: User Story 1 — 의료기관 최초 등록 (Priority: P1) ✅ 완료

**Goal**: 원장이 회원가입 + 기관 등록 후 대시보드 진입, 기존 환자 데이터 조회

- [x] T017 [US1] `app/actions/auth.ts` — `signUp()`, `signIn()`, `signOut()` Server Actions
- [x] T018 [US1] `app/actions/institutions.ts` — `getMyInstitution()` Server Action
- [x] T019 [P] [US1] `app/actions/patients.ts` 수정 — institution_id 필터 + INSERT 포함
- [x] T020 [P] [US1] `app/actions/consultations.ts` 수정 — institution_id 필터 + INSERT 포함
- [x] T021 [P] [US1] `components/auth/signup-form.tsx` — 이메일, 비밀번호, 기관명 입력 폼
- [x] T022 [P] [US1] `app/(auth)/signup/page.tsx` — SignupForm 렌더
- [x] T023 [P] [US1] `components/auth/login-form.tsx` — 이메일, 비밀번호 입력 폼
- [x] T024 [P] [US1] `app/(auth)/login/page.tsx` — LoginForm 렌더
- [x] T025 [US1] `components/layout/header.tsx` — 기관명 + 로그아웃
- [x] T026 [US1] `app/(dashboard)/layout.tsx` — Header 컴포넌트 포함
- [x] T027 [US1] `app/actions/patients.ts` `createPatient`, `updatePatient` — institution_id INSERT/PATCH

**Checkpoint**: ✅ 회원가입 → 로그인 → 기존 환자 데이터 조회 → 로그아웃 완전 동작

---

## Phase 3 추가 작업 (태스크 외) ✅ 완료

- [x] `app/auth/callback/route.ts` — PKCE 이메일 인증 코드 교환 라우트 (이메일 인증 후 자동 로그인)
- [x] `signUp`에 `emailRedirectTo: /auth/callback` 설정
- [x] Supabase Auth Site URL → `https://carelog-tau.vercel.app` 설정 (Management API)
- [x] `lib/supabase/admin.ts` BOM 문자 제거 (`charCodeAt(0) === 0xFEFF` 체크)
- [x] 기존 환자/상담 데이터 시드 기관 → 예미안치과로 이전 (SQL UPDATE)

---

## Phase 4: User Story 2 — 직원 초대 및 역할 관리 (Priority: P2) ⏳ 진행 중

**Goal**: 원장이 직원을 이메일로 초대, 직원이 수락 후 로그인하여 동일 기관 데이터 접근

- [x] T028 [US2] `app/actions/institutions.ts` — `inviteStaff()`, `acceptInvitation()` 완료
- [x] T029 [US2] `lib/supabase/admin.ts` — Service Role 클라이언트 완료
- [ ] T030 [P] [US2] `components/auth/invite-form.tsx` — 토큰 검증 + 비밀번호 설정 폼
- [ ] T031 [P] [US2] `app/(auth)/invite/[token]/page.tsx` — InviteForm 렌더 + 토큰 유효성 확인
- [ ] T032 [P] [US2] `components/institution/invite-staff-form.tsx` — 직원 이메일 + 역할 선택 폼
- [ ] T033 [US2] `app/(dashboard)/settings/page.tsx` — 직원 초대 폼 + 멤버 목록

**Checkpoint**: ⏳ 미착수

---

## Phase 5: User Story 3 — 기존 데이터 기관 귀속 검증 (Priority: P1) ✅ 완료

- [x] T034 [US3] patient 테이블 institution_id NULL 없음 확인
- [x] T035 [US3] consultation 테이블 institution_id NULL 없음 확인
- [x] T036 [US3] 기관 계정 로그인 후 환자 전체 목록 조회 정상 확인

**Checkpoint**: ✅ 데이터 손실률 0% 확인

---

## Phase 6: Polish & 마무리 ✅ 완료

- [x] T037 [P] `docs/architecture.md` 업데이트 — Route Groups, middleware, auth 흐름 추가
- [x] T038 [P] `docs/database.md` 업데이트 — 신규 테이블 3개 + RLS 정책 변경 반영
- [x] T039 [P] `supabase/schema.sql` 업데이트 — 마이그레이션 SQL 전체 반영
- [x] T040 `supabase/migrations/20260509000001_staff_auth_institution.sql` 생성
- [x] T041 `project_status.md` 업데이트
- [x] T042 검증 시나리오 실행: 회원가입 → 이메일 인증 → 로그인 → 환자 조회 모두 통과
- [x] T043 `npm run build` — 빌드 에러 없음 확인
- [x] T044 GitHub push + Vercel 배포 확인

---

## 의존성 & 실행 순서

- **Phase 1~3, 5, 6**: ✅ 완료
- **Phase 4**: T030~T033 미착수 (다음 세션)

---

## 총 태스크 수

| Phase | 태스크 수 | 상태 |
|---|---|---|
| Phase 1 Setup | 7 | ✅ 완료 |
| Phase 2 Foundational | 9 | ✅ 완료 |
| Phase 3 US1 | 11 | ✅ 완료 |
| Phase 4 US2 | 6 | ⏳ T028-T029 완료, T030-T033 미착수 |
| Phase 5 US3 | 3 | ✅ 완료 |
| Phase 6 Polish | 8 | ✅ 완료 |
| **합계** | **44** | **40/44 완료** |
