# spec 029 (기획) — 상담자료 관리 체계: 전역(다분과) · 기관 카테고리 · 권한

> 상태: **기획 — 논의점 확정 대기.** 대표 지시(세션 66): ① 공통자료는 슈퍼어드민 메뉴 + 다분과 구조
> ② 기관 자체 자료의 카테고리화 관리 UX, 관리 권한은 admin → 개인별 부여는 '설정'에서, 권한 시스템은 EO와 동일 구조,
> 인적 체계는 EO 연결 활용.
> 작성: 다온 · 2026-07-08 · 선행: spec 025/026(자료 라이브러리), EO spec-050/054(권한), 카드 235(EO 연동)

## 1. 전역(Carelog 공통) 자료 — 슈퍼어드민 + 다분과

### 1-1. 분과(specialty) 축
- 기관 분과 = **`institutions.type`** (이미 존재, 현재 'dental' 고정). 분과 목록은 코드 config `SPECIALTIES`(확장형): dental(치과)부터, 추후 피부과·성형·한방·정형 등 추가.
- **분과 지정 주체**: EO 연동 기관은 **EO `clinic_type`을 게이트웨이 마스터에서 자동 동기화**(EO가 이미 보유·전송 중 — 마스터 payload `clinic.clinic_type`), 비연동 기관은 슈퍼어드민이 /admin 기관 카드에서 지정. → 논의점 ①
- 전역 자료에 **`specialty` 컬럼 추가**(null=전 분과 공통, 'dental'=치과 전용). 기관 자료는 자기 분과가 자명하므로 미사용.
- 노출: 내 기관 분과와 일치(또는 공통)하는 전역 자료만 픽커에 노출. v1은 서버 액션 필터, RLS 강화는 후속. → 논의점 ②

### 1-2. 카테고리 — 분과별 기본 세트
- 현행 하드코딩 카테고리(임플란트·신경치료… = 치과 전용)를 **분과별 기본 카테고리 config**로 재구성:
  `SPECIALTY_CATEGORIES: { dental: [...현행 8종], ... }` — 새 분과 추가 = config 한 블록.
- 전역 자료의 카테고리는 대상 분과의 기본 세트를 사용(전 분과 공통 자료는 공용 소세트: 동의서·일반 등).

### 1-3. 슈퍼어드민 발행 UI — `/admin/assets`
- 공지 발행(/admin/announcements)과 같은 구도: 업로드(이미지/영상 링크) + **분과 타겟**(전체/치과/…) + 카테고리 + 캡션 + 활성 토글 + 목록(분과·종류 필터).
- 발행/수정 = service_role(isSuperAdmin 가드) — 기존 announcements 패턴 재사용. /admin에 진입 링크.
- 픽커: **[우리 기관] / [Carelog 제공] 탭(또는 출처 뱃지)** — 전역 자료는 기관이 수정 불가(보기·삽입만).

## 2. 기관 자료 카테고리화 관리 UX

### 2-1. 커스텀 카테고리
- 새 테이블 **`consult_asset_categories`**(id uuid, institution_id, name, display_order, active, created_at) — 기관이 추가·이름변경·정렬·숨김.
- 자료의 `category` 값 = 분과 기본 카테고리 slug **또는** 커스텀 카테고리 id. 표시 시 병합(기본 세트 + 기관 커스텀).
- v1: **기본 카테고리는 고정**(숨김·개명 불가), 커스텀만 자유 — 단순성 우선. → 논의점 ③

### 2-2. 관리 화면 개선 (설정 → 상담 자료)
- 카테고리 탭 필터 + 검색.
- "카테고리 관리" 팝오버: 추가 · 이름변경 · 순서(위/아래) · 숨김.
- 자료 카드에서 카테고리 변경(셀렉트) — 드래그 이동은 후속.
- 픽커의 카테고리 칩도 병합 세트로 자동 반영.

## 3. 권한 — EO 3층 모델 이식

EO 실구조(확인): ① 코드 기본값 `DEFAULT_PERMISSIONS`(역할→기능) → ② 워크스페이스 역할 기본값 오버라이드 → ③ **개인 오버라이드**(`permission_overrides` 테이블, allow/deny). 판정 = ③ > ② > ①.

### 3-1. Carelog 적용 (v1)
- `lib/permissions.ts`: `FEATURES` config — 시작 키 2개(→ 논의점 ④):
  - `consult_assets.manage` 상담자료 관리
  - `treatment_items.manage` 치료 항목·수가 관리
- 코드 기본값: owner·admin = 허용, staff = 차단. (**②층 역할 기본값 커스터마이즈는 후속** — 대표 요구가 "admin 기본 + 개인별 부여"라 ①+③로 충족)
- 테이블 **`permission_overrides`**(id, institution_id, member_id → institution_members cascade, feature_id text, allowed bool, granted_by, created_at, unique(member_id, feature_id)).
- 헬퍼 `hasFeature(featureId)`: 개인 오버라이드 → 역할 기본값. 기존 `requireOwnerAdmin`(consult-assets·treatment-items 액션)을 이 헬퍼로 교체.
- **설정 UI**: 설정 → 직원·권한 그룹에 "기능 권한" 섹션(admin 전용) — 직원(institution_members 계정) × 기능 토글. EO '개인 권한 설정'과 같은 UX.

### 3-2. 인적 체계 — EO 연결 (이미 있는 것 + 메꿀 것)
- 이미 연결됨: SSO 진입 시 계정 자동 합류 + `eo_role` 매핑(clinic_admin→admin) + 작성자 귀속(eo_employee_id), EO 직원 마스터 10분 폴링 캐시(clinic_members).
- 권한 부여 대상 = **institution_members(로그인 계정)** 기준 — 권한은 계정에만 의미. 명단(clinic_members)은 참여자 선택용으로 분리 유지.
- ⚠️ **갭 발견**: EO에서 퇴사 처리(resign_date)돼도 Carelog 계정(institution_members)은 **자동 비활성화되지 않음** — 마스터 동기화가 명단만 갱신. 권한 체계의 짝으로 "EO 퇴사 → Carelog 계정 자동 비활성" 동기화를 포함 제안. → 논의점 ⑤

## 4. 단계 제안 → 논의점 ⑥

| 차수 | 내용 | 마이그레이션 |
|---|---|---|
| 1차 | `/admin/assets` 전역 발행(분과 타겟) + 픽커 출처 구분 + 분과 config + 기관 분과 동기화/지정 | consult_assets.specialty 1컬럼 |
| 2차 | 기관 커스텀 카테고리 + 관리 UX 개선(탭·검색·카테고리 관리) | consult_asset_categories |
| 3차 | 권한 프레임(FEATURES+overrides+hasFeature) + 설정 '기능 권한' UI + 기존 가드 교체 | permission_overrides |
| 후속 | EO 퇴사 동기화, 역할 기본값 커스터마이즈(②층), RLS 분과 필터 강화 | — |

## 5. 논의점 (대표 확정 요청)

1. **분과 지정**: EO 연동 기관 = EO clinic_type 자동 / 비연동 = 슈퍼어드민 수동 — 이 이원화로 OK? 초기 분과 목록은 치과 하나로 시작?
2. **분과 필터 위치**: v1 서버 액션 필터(타 분과 자료는 안 보일 뿐) — RLS 강화는 후속으로 미뤄도 되는지.
3. **기본 카테고리 고정**: 기관은 커스텀 추가만(기본 숨김·개명 불가) — v1 단순화 동의?
4. **권한 시작 키**: 상담자료·치료항목 2개로 시작(프레임은 범용, 키는 점진 추가) — 아니면 자료 관리 1개로?
5. **EO 퇴사 → 계정 자동 비활성**: 권한 체계와 세트로 포함할지(후속 차수), 정책(비활성 vs 제거)은?
6. **차수 순서**: 1차(전역 발행)부터? 아니면 예미안 실사용 관점에서 2차(기관 카테고리 UX)가 먼저 급한지?
