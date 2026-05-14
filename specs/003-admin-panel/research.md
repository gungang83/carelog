# Research: Carelog 어드민 패널

**Date**: 2026-05-14  
**Feature**: 003-admin-panel

---

## Decision 1: 복수 기관 활성 기관 저장 방식

**Decision**: HTTP-only 쿠키 (`carelog_active_institution`) 에 `institution_id` 저장

**Rationale**:
- Server Components와 Server Actions 모두에서 읽을 수 있음 (쿠키는 RSC에서 `cookies()` API로 읽기 가능)
- DB 쿼리 불필요 — 레이아웃 렌더마다 추가 왕복 없음
- 새로고침 후에도 유지됨 (영구 쿠키, 30일 만료)
- 단일 기관 사용자에게는 쿠키 없이도 동작 (폴백: 첫 번째 기관 자동 선택)

**Alternatives considered**:
- DB 컬럼(`active_institution_id` on users): DB 쿼리 추가 필요, Supabase Auth users 테이블 수정 복잡
- URL 파라미터: 모든 링크에 기관 id 포함해야 하므로 불필요한 복잡성
- Zustand/localStorage: 서버 렌더링과 불일치 (hydration 문제)

---

## Decision 2: 직원 접근 권한 제어 방식

**Decision**: `institution_members` 테이블에 `is_active boolean NOT NULL DEFAULT true` 컬럼 추가

**Rationale**:
- 기존 테이블 확장으로 스키마 변경 최소화
- `is_active = false`이면 해당 기관 데이터에 접근 불가 — RLS 정책과 Server Action 양쪽에서 체크
- 계정 삭제가 아니므로 복수 기관 소속 직원의 다른 기관 접근에 영향 없음
- 비활성화/재활성화 토글로 관리자 실수 복구 가능

**Alternatives considered**:
- `institution_members` 행 삭제: 복구 불가, 감사 추적 어려움
- 별도 `staff_permissions` 테이블: 오버엔지니어링, is_active 하나를 위해 조인 추가

---

## Decision 3: 최고 관리자 식별 방식

**Decision**: `SUPER_ADMIN_EMAIL` 환경변수 (기본값: `mobys0416@gmail.com`)

**Rationale**:
- 단순하고 즉시 동작
- 환경변수로 분리하여 코드 변경 없이 변경 가능
- Vercel 환경변수에 등록하면 배포 환경에서도 동작
- v1 단계에서 단일 슈퍼 어드민이면 충분

**Alternatives considered**:
- DB `super_admins` 테이블: 유연하지만 현재 단일 계정에 오버엔지니어링
- Supabase Auth custom claim (JWT): 복잡한 Edge Function 설정 필요

**향후 확장**: 복수 슈퍼 어드민이 필요하면 `SUPER_ADMIN_EMAILS` (콤마 구분)으로 확장하거나 DB 테이블로 마이그레이션

---

## Decision 4: 기관 전환 UI 상호작용 방식

**Decision**: 클라이언트 컴포넌트 드롭다운 → Server Action으로 쿠키 설정 → `router.refresh()`

**Rationale**:
- 기관 전환 시 전체 페이지 데이터를 새로 로드해야 함 (다른 기관 데이터)
- Server Action이 쿠키를 설정하고 revalidate → RSC가 새 기관 데이터로 리렌더
- `router.refresh()`로 전체 RSC 트리 무효화 (redirect 없이 현재 페이지 유지)

**Alternatives considered**:
- 페이지 redirect: UX 단절, 느림
- 클라이언트에서 직접 쿠키 설정: `HttpOnly` 쿠키 사용 불가

---

## Decision 5: 어드민 라우트 구조

**Decision**: `/settings` (기관 어드민) + `/admin` (최고 관리자 전용)

**Rationale**:
- 역할별 명확한 URL 구분
- `/settings`는 모든 owner/admin 역할 접근, `/admin`은 슈퍼 어드민만 접근
- 미들웨어에서 `/admin` 접근 시 슈퍼 어드민 여부 검증

**Route structure**:
```
app/(dashboard)/
├── settings/page.tsx      # 기관 관리자 전용 (owner/admin 역할)
│   ├── 직원 목록 + 권한 토글
│   ├── 직원 초대 폼
│   └── 기관 정보 수정
└── admin/page.tsx         # 슈퍼 어드민 전용
    ├── 전체 기관 목록
    └── 기관별 직원 관리
```

---

## Decision 6: 기존 `getMyInstitutionId()` 처리

**Decision**: 기존 함수 유지하되 쿠키 우선 조회로 수정 + 복수 기관 쿼리 함수 추가

**Rationale**:
- `getMyInstitutionId()`는 많은 Server Action에서 호출됨 — 시그니처 변경 최소화
- 쿠키에 유효한 institution_id가 있으면 그것을 반환 (단, 해당 기관의 멤버인지 DB 검증)
- 쿠키 없거나 유효하지 않으면 첫 번째 기관 반환 (기존 동작 유지)
- 새 함수 `getMyInstitutions()`: 사용자의 모든 기관 목록 반환 (헤더 드롭다운용)

**Impact on RLS**: 기존 `get_my_institution_id()` DB 함수는 institution_members에서 첫 행을 반환 — 복수 기관 시 RLS가 여러 기관 데이터 허용할 수 있음. Server Action에서 explicit `institution_id` 필터가 실제 격리를 담당하므로 RLS는 보조 레이어로 유지.
