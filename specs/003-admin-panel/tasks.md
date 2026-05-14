# Tasks: 어드민 패널

**Input**: `specs/003-admin-panel/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

---

## Phase 1: Setup (공유 인프라)

**Purpose**: DB 마이그레이션 파일, 환경변수 준비

- [ ] T001 `supabase/migrations/20260514000001_admin_panel.sql` 생성 — `ALTER TABLE institution_members ADD COLUMN is_active boolean NOT NULL DEFAULT true;` DDL 포함
- [ ] T002 `.env.local`에 `SUPER_ADMIN_EMAIL=mobys0416@gmail.com` 추가 (Vercel에도 동일하게 등록 필요)

---

## Phase 2: Foundational (모든 User Story의 전제)

**Purpose**: DB 스키마 반영, 공유 유틸, 타입 업데이트 — 완료 전 User Story 구현 불가

**⚠️ CRITICAL**: T003 DB 마이그레이션 실행 후 User Story 구현 시작

- [ ] T003 Supabase SQL Editor에서 `supabase/migrations/20260514000001_admin_panel.sql` 실행 — `institution_members.is_active` 컬럼 생성 확인
- [ ] T004 [P] `lib/types/database.ts` 수정 — `InstitutionMemberRow`에 `is_active: boolean` 필드 추가
- [ ] T005 [P] `lib/admin.ts` 생성 — `isSuperAdmin(email: string | null | undefined): boolean` 함수 구현 (`SUPER_ADMIN_EMAIL` 환경변수 기반, 기본값 `mobys0416@gmail.com`)
- [ ] T006 `lib/auth/institution.ts` 수정 — `getMyInstitutionId()`를 쿠키(`carelog_active_institution`) 우선 조회로 변경, 쿠키값이 있으면 해당 기관 멤버십 존재 & `is_active=true` DB 검증 후 반환, 없으면 기존 로직(첫 기관) 유지

**Checkpoint**: `npm run build` 통과 + DB에 `is_active` 컬럼 존재 확인

---

## Phase 3: User Story 1 — 복수 기관 전환 (Priority: P1) 🎯 MVP 시작

**Goal**: 복수 기관 소속 직원이 헤더 드롭다운으로 현재 작업 기관을 전환한다

**Independent Test**: 두 기관에 소속된 테스트 계정으로 로그인 → 헤더 드롭다운 확인 → 기관 전환 → 대시보드 데이터 변경 + 새로고침 후 유지 확인

- [ ] T007 [P] [US1] `lib/auth/institution.ts` 업데이트 — `getMyInstitutions()` 함수 추가: 사용자의 전체 기관 목록을 `Array<{ institution: InstitutionRow; role: string; is_active: boolean }>` 형태로 반환
- [ ] T008 [P] [US1] `app/actions/admin.ts` 생성 — `switchInstitution(institutionId: string)` Server Action 구현: 사용자가 해당 기관의 멤버 & `is_active=true` 검증 후 `carelog_active_institution` 쿠키(HttpOnly, maxAge 30일) 설정
- [ ] T009 [US1] `components/layout/institution-switcher.tsx` 생성 — 클라이언트 컴포넌트: 복수 기관이면 드롭다운 UI, 단일 기관이면 기관명 텍스트만 표시, 선택 시 `switchInstitution()` 호출 후 `router.refresh()`
- [ ] T010 [US1] `app/(dashboard)/layout.tsx` 수정 — `.maybeSingle()` → `getMyInstitutions()` 호출로 교체, 활성 기관 쿠키 읽어 `activeInstitutionId` 결정, `Header`에 `institutions`와 `activeInstitutionId` props 전달
- [ ] T011 [US1] `components/layout/header.tsx` 수정 — props를 `{ institutionName: string }` → `{ institutions: ...[]; activeInstitutionId: string }` 로 교체, `<InstitutionSwitcher>` 렌더, 설정 링크(`/settings`) 추가

**Checkpoint**: 복수 기관 계정으로 기관 전환 동작 + 새로고침 유지 확인 (quickstart 시나리오 1, 2)

---

## Phase 4: User Story 2 — 기관 직원 권한 관리 (Priority: P1)

**Goal**: 기관 관리자(owner/admin)가 `/settings`에서 직원 목록을 보고 접근 권한을 즉시 활성화/비활성화한다

**Independent Test**: owner 계정으로 `/settings` 접속 → 직원 목록 확인 → 특정 직원 비활성화 → 해당 직원 계정으로 로그인 시 "접근 권한 없음" 표시 확인

- [ ] T012 [US2] `app/actions/admin.ts` 업데이트 — `getStaffList()` 추가: admin client로 현재 기관의 `institution_members` 전체 조회 + `auth.admin.listUsers()`로 이메일 매핑하여 `StaffMemberView[]` 반환 (owner/admin 권한 검증 포함)
- [ ] T013 [US2] `app/actions/admin.ts` 업데이트 — `setStaffActive(memberId: string, isActive: boolean)` 추가: ① 슈퍼 어드민 계정 변경 불가 ② 기관 마지막 active owner 비활성화 불가 ③ 자기 자신 비활성화 불가 검증 후 `institution_members.is_active` 업데이트, `revalidatePath('/settings')`
- [ ] T014 [P] [US2] `components/settings/staff-list.tsx` 생성 — 직원 목록 테이블(이메일, 역할, 활성 상태 배지) + is_active 토글 버튼, 비활성화 시 확인 다이얼로그, `setStaffActive()` 호출
- [ ] T015 [P] [US2] `components/settings/staff-invite-form.tsx` 생성 — 이메일 입력 + 역할 선택(admin/staff) 초대 폼, 기존 `inviteStaff()` Server Action 사용
- [ ] T016 [US2] `app/(dashboard)/settings/page.tsx` 생성 — owner/admin 권한 검증(아니면 `/` 리다이렉트) + `<StaffList>` + `<StaffInviteForm>` 렌더, 탭 UI(직원 관리 | 직원 초대)
- [ ] T017 [US2] `app/(dashboard)/layout.tsx` 수정 — 현재 기관에서 `is_active=false`인 사용자 접근 시 대시보드 대신 "이 기관에 대한 접근 권한이 없습니다" 안내 화면 렌더 (children 대신 표시)

**Checkpoint**: 직원 비활성화 → 해당 직원 접근 차단 + 재활성화 복구 확인 (quickstart 시나리오 3, 4)

---

## Phase 5: User Story 3 — 최고 관리자 통합 관리 (Priority: P2)

**Goal**: `mobys0416@gmail.com`으로 로그인 시 `/admin`에서 전체 기관 목록과 각 기관 직원 권한을 통합 관리한다

**Independent Test**: 슈퍼 어드민 계정 로그인 → 헤더 "관리자" 링크 확인 → `/admin`에서 전체 기관 목록 조회 → 기관 선택 → 직원 권한 변경 확인

- [ ] T018 [US3] `app/actions/admin.ts` 업데이트 — `getAllInstitutions()` 추가: `isSuperAdmin()` 검증 후 전체 기관 + 각 기관 직원 수 / 활성 직원 수 반환
- [ ] T019 [US3] `app/actions/admin.ts` 업데이트 — `getInstitutionStaff(institutionId)` + `setStaffActiveAsAdmin(memberId, isActive)` 추가: 모두 `isSuperAdmin()` 검증 선행
- [ ] T020 [P] [US3] `components/admin/institution-table.tsx` 생성 — 전체 기관 목록 테이블(기관명, 직원 수, 활성 직원 수, 생성일), 행 클릭 시 해당 기관 직원 패널 열기
- [ ] T021 [P] [US3] `components/admin/institution-staff-panel.tsx` 생성 — 선택된 기관의 직원 목록 + `setStaffActiveAsAdmin()` 토글 버튼
- [ ] T022 [US3] `app/(dashboard)/admin/page.tsx` 생성 — `isSuperAdmin()` 검증(실패 시 `/` 리다이렉트) + `<InstitutionTable>` + `<InstitutionStaffPanel>` 렌더
- [ ] T023 [US3] `components/layout/header.tsx` 수정 — 슈퍼 어드민 계정일 때 "관리자" 링크(`/admin`) 헤더에 추가 (`isSuperAdmin()` 서버 사이드 체크)

**Checkpoint**: `/admin` 전체 기관 조회 + 타 기관 직원 권한 변경 확인 (quickstart 시나리오 7, 8)

---

## Phase 6: User Story 4 — 기관 프로필 설정 (Priority: P3)

**Goal**: 기관 관리자(owner)가 `/settings`에서 기관명을 수정하면 헤더와 SMS에 즉시 반영된다

**Independent Test**: owner 계정 → `/settings` 기관 정보 탭 → 기관명 변경 → 저장 → 헤더 기관명 변경 확인

- [ ] T024 [P] [US4] `app/actions/admin.ts` 업데이트 — `updateInstitutionName(name: string)` 추가: owner 권한 검증, name trim 후 1자 이상 검증, `institutions.name` 업데이트, `revalidatePath('/')` + `revalidatePath('/settings')`
- [ ] T025 [P] [US4] `components/settings/institution-form.tsx` 생성 — 기관명 입력 폼, `updateInstitutionName()` 호출, 성공/실패 메시지 표시
- [ ] T026 [US4] `app/(dashboard)/settings/page.tsx` 수정 — "기관 정보" 탭 추가, `<InstitutionForm>` 렌더 (현재 기관명 초기값으로 전달)

**Checkpoint**: 기관명 수정 → 헤더 즉시 반영 확인 (quickstart 시나리오 5)

---

## Phase 7: Polish & 마무리

- [ ] T027 quickstart.md 10개 시나리오 수동 실행 — 전체 통과 확인 (시나리오 9, 10: 엣지케이스 포함)
- [ ] T028 [P] `docs/architecture.md` 업데이트 — `/settings`, `/admin` 라우트, `institution-switcher.tsx`, `lib/admin.ts`, `app/actions/admin.ts` 반영
- [ ] T029 [P] `docs/database.md` 업데이트 — `institution_members.is_active` 컬럼 추가 반영
- [ ] T030 [P] `supabase/schema.sql` 업데이트 — `is_active` 컬럼 DDL 반영
- [ ] T031 [P] `project_status.md` 업데이트 — 어드민 패널 기능 완료 표시
- [ ] T032 `npm run build` 실행 — 타입 에러, 빌드 에러 없음 확인 후 `git push origin main`

---

## 의존성 & 실행 순서

### Phase 의존성

- **Phase 1** (Setup): 즉시 시작 가능
- **Phase 2** (Foundational): Phase 1 완료 후 — **T003 DB 마이그레이션이 모든 US 블로킹**
- **Phase 3** (US1): Phase 2 완료 후
- **Phase 4** (US2): Phase 2 완료 후 (US1과 병렬 가능하나 T010/T011 변경 파일 충돌 주의)
- **Phase 5** (US3): Phase 4 완료 후 권장 (header.tsx T023이 T011 이후 변경)
- **Phase 6** (US4): Phase 4 완료 후 (settings/page.tsx T026이 T016 이후 변경)
- **Phase 7** (Polish): Phase 3~6 완료 후

### 같은 파일 내 순서 주의

`app/actions/admin.ts`는 T008 → T012 → T013 → T018 → T019 → T024 순서로 함수 추가.  
각 태스크는 해당 함수만 추가하며 기존 함수를 덮어쓰지 않도록 주의.

`components/layout/header.tsx`는 T011(US1 switcher) → T023(US3 관리자 링크) 순서로 수정.

`app/(dashboard)/layout.tsx`는 T010(US1 기관 목록) → T017(US2 is_active 차단) 순서로 수정.

`app/(dashboard)/settings/page.tsx`는 T016(US2 기본 페이지 생성) → T026(US4 기관 정보 탭 추가) 순서로 수정.

### 병렬 실행 기회

```
Phase 1: T001, T002 동시 실행
Phase 2: T004, T005 동시 실행 (T003 완료 후)
Phase 3: T007, T008 동시 실행 → 완료 후 T009 → T010 → T011 순차
Phase 4: T014, T015 동시 실행 (T012, T013 순차 완료 후)
Phase 5: T020, T021 동시 실행 (T018, T019 순차 완료 후)
Phase 6: T024, T025 동시 실행 → 완료 후 T026
Phase 7: T028, T029, T030, T031 동시 실행
```

---

## 구현 전략

### MVP (Phase 1~4: US1+US2 완료)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1 (기관 전환 드롭다운)
3. Phase 4 US2 (직원 권한 관리)
4. **STOP**: quickstart 시나리오 1~4 검증 → 배포
5. 기관 관리자가 직원 권한을 직접 제어할 수 있는 최소 제품

### Full (Phase 5~6 추가)

MVP 배포 후 Phase 5(슈퍼 어드민) → Phase 6(기관 프로필) → Phase 7(문서화 + 배포)

---

## 총 태스크 수

| Phase | 태스크 수 | 비고 |
|---|---|---|
| Phase 1 Setup | 2 | 즉시 시작 |
| Phase 2 Foundational | 4 | DB 마이그레이션 포함 |
| Phase 3 US1 | 5 | 기관 전환 MVP |
| Phase 4 US2 | 6 | 직원 권한 관리 MVP |
| Phase 5 US3 | 6 | 슈퍼 어드민 |
| Phase 6 US4 | 3 | 기관 프로필 |
| Phase 7 Polish | 6 | 문서+검증 |
| **합계** | **32** | |
