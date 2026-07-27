# spec 029 (기획) — 상담자료 관리 체계: 전역(다분과) · 기관 카테고리 · 권한

> 상태: **구현 완료(세션 66i — 1·2·3차 통합, 대표 지시 '다 한꺼번에')** — 마이그레이션 `20260708000005_asset_mgmt_permissions.sql` 실행 후 배포. 대표 지시(세션 66): ① 공통자료는 슈퍼어드민 메뉴 + 다분과 구조
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

## 2. 기관 카테고리 = 큐레이션 (대표 확정, 2026-07-08 — v2 재설계)

> 확정 개념: 카테고리는 자료의 '속성'이 아니라 **기관이 구성하는 그릇**. 기관이 카테고리를 만들고,
> **Carelog 제공 Library + 우리 기관 Library에서 '쓸 자료들'을 골라 카테고리에 담는다.**

### 2-1. 데이터 모델 (2층: Library → 카테고리)
- **Library(원천) 2개**: 전역(consult_assets institution_id null, 슈퍼어드민 소유) / 기관 업로드(institution_id=기관).
  자료의 `category` 필드는 **Library 분류**(분과 기본 세트)로 역할 축소 — Library 탐색 필터용.
- **`consult_asset_categories`**(id, institution_id, name, display_order, active, created_at) — 기관 카테고리(그릇).
- **`consult_asset_category_items`**(id, category_id → categories cascade, asset_id → consult_assets cascade,
  display_order, added_by, created_at, unique(category_id, asset_id)) — 담기(참조).
  전역 자료도 담기 가능(참조일 뿐 — 원본은 슈퍼어드민만 수정). **같은 자료를 여러 카테고리에 중복 담기 허용**.
  전역 자료가 비활성화되면 담긴 카테고리에서도 자동 제외(조회 시 active 필터).

### 2-2. 관리 UX (설정 → 상담 자료 — 2패널)
- 좌: 카테고리 목록(추가·이름변경·순서·숨김) / 우: 선택 카테고리에 담긴 자료(순서 조정·빼기).
- **[+ 자료 담기]** → Library 브라우저 팝업: 탭 [우리 기관] [Carelog 제공] + 분과 기본 분류·검색 → 체크 선택 → 담기.
- 새 업로드는 기관 Library에 추가 → "지금 카테고리에 담기" 바로 옵션.
- 기관 Library 자체 관리(업로드·숨김·삭제)는 현행 화면 유지(브라우저 안에서 접근).

### 2-3. 픽커(상담 중) 뷰
- 기본 뷰 = **기관이 구성한 카테고리들** → 담긴 자료(구성한 순서). 직원은 큐레이션된 것만 보면 된다.
- 카테고리를 아직 구성하지 않은 기관 = 현행처럼 전체 Library 노출(폴백) — 구성 전에도 기능 정상.
- '전체 Library' 탭은 픽커에도 유지(카테고리에 안 담긴 자료 급히 찾는 경우).

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

## 4. 차수(배포 단위) — v2 개정

> "차수" = 한 번에 다 만들지 않고 **배포 가능한 덩어리로 나눠 순서대로 내보내는 단위**.

| 차수 | 내용 | 마이그레이션 |
|---|---|---|
| 1차 | Library 층 완성: `/admin/assets` 전역 발행(분과 타겟) + 픽커 [우리 기관]/[Carelog 제공] 구분 + 분과 config·동기화 | consult_assets.specialty |
| 2차 | 큐레이션: 카테고리 그릇 + 담기 + 관리 2패널 UX + 픽커 카테고리 뷰(§2 v2) | categories + category_items |
| 3차 | 권한 프레임 + 설정 '기능 권한' UI + 가드 교체 + **EO 퇴사 자동 비활성**(마스터 동기화 연계) | permission_overrides |
| 후속 | 역할 기본값 커스터마이즈(②층), RLS 분과 필터 강화 | — |

## 5. 논의점 확정 이력 (2026-07-08 대표 회신)

1. ✅ 분과 이원화(EO clinic_type 자동/비연동 수동) · 치과부터 시작
2. ✅ v1 서버 액션 필터, RLS 강화 후속
3. ✅ **큐레이션 모델로 재설계**(§2 v2) — 카테고리는 그릇, Library(전역+기관)에서 골라 담기
4. ✅ 권한 시작 키 2개(상담자료·치료항목)
5. ✅ EO 퇴사 → Carelog 계정 **자동 비활성**(제거 아님 — 기록 귀속 보존) 포함
6. 차수 = 배포 단위 분할(아래 §4 개정). 잔여 미세 논점: (a) 자료의 복수 카테고리 중복 담기 **허용**(다온 제안)
   (b) 카테고리 미구성 기관은 픽커에 전체 Library 폴백(다온 제안) — 이견 없으면 이대로.
