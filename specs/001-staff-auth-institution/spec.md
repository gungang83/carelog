# Feature Specification: 직원 로그인 및 의료기관 계정 구조

**Feature Branch**: `001-staff-auth-institution`  
**Created**: 2026-05-08  
**Status**: Draft  
**연관 문서**: [docs/patient-portal-vision.md](../../docs/patient-portal-vision.md)

---

## User Scenarios & Testing

### User Story 1 — 의료기관 최초 등록 (Priority: P1)

치과 원장(대표자)이 Carelog에 의료기관 계정을 처음 만들고 오너 계정으로 로그인한다.

**Why this priority**: 모든 다른 기능의 전제 조건. 기관 계정 없이 직원 추가·환자 관리 불가.

**Independent Test**: 이메일+비밀번호로 회원가입 → 기관명 입력 → 로그인 → 대시보드 접근 가능 여부 확인.

**Acceptance Scenarios**:

1. **Given** 신규 사용자가 회원가입 페이지에 접근, **When** 이메일·비밀번호·기관명 입력 후 제출, **Then** 계정 생성 + `institutions` 레코드 생성 + `institution_members`에 `owner` 역할로 등록됨
2. **Given** 등록된 이메일로 로그인 시도, **When** 올바른 비밀번호 입력, **Then** 기관 대시보드로 이동하며 기관명이 표시됨
3. **Given** 잘못된 비밀번호 입력, **When** 로그인 시도, **Then** 명확한 오류 메시지 표시, 계정 잠금 없음

---

### User Story 2 — 직원 초대 및 역할 관리 (Priority: P2)

원장이 직원(어시스턴트, 상담사 등)을 기관에 초대하고 역할을 부여한다.

**Why this priority**: 실제 클리닉 운영은 다수 직원이 사용하므로 Phase 1 완성에 필수.

**Independent Test**: 원장 계정 → 직원 이메일 초대 → 직원이 초대 수락 → 직원 계정으로 로그인 시 같은 기관 환자 데이터 접근 가능 여부 확인.

**Acceptance Scenarios**:

1. **Given** 원장이 로그인된 상태, **When** 직원 이메일 입력 후 초대 전송, **Then** 해당 이메일로 초대 링크 발송
2. **Given** 직원이 초대 링크 클릭, **When** 비밀번호 설정 후 가입, **Then** `institution_members`에 `staff` 역할로 등록, 기관 대시보드 접근 가능
3. **Given** `staff` 역할 직원 로그인, **When** 환자 목록 접근, **Then** 자신이 소속된 기관의 환자만 표시 (타 기관 데이터 접근 불가)

---

### User Story 3 — 기존 환자 데이터 기관 귀속 (Priority: P1)

현재 DB에 있는 기존 환자·상담 데이터를 생성되는 기관 계정에 귀속시킨다.

**Why this priority**: 기존 사용 중인 데이터를 마이그레이션하지 않으면 Phase 1 전환이 불가.

**Independent Test**: 마이그레이션 후 기존 환자 레코드에 `institution_id`가 채워져 있고, 해당 기관 계정으로 로그인 시 정상 조회됨.

**Acceptance Scenarios**:

1. **Given** 마이그레이션 SQL 실행 후, **When** 기관 계정으로 환자 목록 조회, **Then** 기존 모든 환자 데이터가 표시됨 (데이터 손실 없음)
2. **Given** RLS 정책 활성화 후, **When** 기관 계정으로 조회, **Then** 자기 기관 데이터만 반환 (타 기관 데이터 노출 없음)

---

### Edge Cases

- 동일 이메일로 중복 가입 시도 → 명확한 안내 메시지
- 초대 링크 만료(24시간) 후 접근 → 재초대 요청 안내
- 원장이 자기 자신을 삭제하려 할 때 → 최소 1명의 owner 유지 강제
- 기관에 소속 없는 계정으로 대시보드 접근 → 기관 등록 유도 화면

---

## Requirements

### Functional Requirements

- **FR-001**: 시스템은 이메일+비밀번호 방식으로 계정 생성을 지원해야 한다
- **FR-002**: 계정 생성 시 의료기관 정보(기관명)를 함께 등록해야 한다
- **FR-003**: 기관 오너는 이메일로 신규 직원을 초대할 수 있어야 한다
- **FR-004**: 직원 역할은 `owner`, `admin`, `staff` 3단계로 구분되어야 한다
- **FR-005**: 로그인한 사용자는 자신이 소속된 기관의 데이터만 접근할 수 있어야 한다 (RLS)
- **FR-006**: 기존 환자·상담 데이터는 마이그레이션을 통해 특정 기관에 귀속되어야 한다
- **FR-007**: 기관명은 로그인 후 UI 어딘가에 항상 표시되어야 한다
- **FR-008**: 로그아웃 기능이 제공되어야 한다

### Key Entities

- **Institution**: 의료기관 워크스페이스 (name, type, created_at)
- **InstitutionMember**: 직원-기관 소속 관계 (user_id, institution_id, role)
- **Invitation**: 직원 초대 토큰 (email, institution_id, expires_at, accepted_at)

---

## Success Criteria

- **SC-001**: 신규 원장이 회원가입부터 기관 대시보드 진입까지 3분 이내 완료
- **SC-002**: 직원 초대부터 직원이 로그인하여 환자 데이터 접근까지 5분 이내
- **SC-003**: 기존 데이터 마이그레이션 후 환자 레코드 손실률 0%
- **SC-004**: 기관 격리 — 로그인한 계정이 타 기관 데이터를 조회할 수 없음 (100%)
- **SC-005**: 로그인 세션이 브라우저 탭 종료 후에도 유지됨 (재방문 시 자동 로그인)

---

## Assumptions

- 초기 단계에서 기관당 사용자 수는 소규모 (1~10명)
- 이메일 발송은 Supabase Auth 내장 이메일 기능 활용 (별도 SMTP 불필요)
- 한 사용자가 여러 기관에 소속될 수 있는 구조는 스키마에 열어두되, Phase 1 UI에서는 단일 기관만 지원
- 카카오 로그인 등 소셜 로그인은 Phase 1 범위 외
- 환자 로그인은 Phase 3에서 별도 구현
