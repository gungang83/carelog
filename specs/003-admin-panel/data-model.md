# Data Model: Carelog 어드민 패널

**Date**: 2026-05-14

---

## 기존 테이블 변경

### institution_members (기존 테이블 확장)

| 컬럼 | 타입 | 변경 | 설명 |
|---|---|---|---|
| id | uuid PK | 기존 | |
| institution_id | uuid FK | 기존 | institutions.id 참조 |
| user_id | uuid FK | 기존 | auth.users.id 참조 |
| role | text | 기존 | 'owner' \| 'admin' \| 'staff' |
| invited_by | uuid FK | 기존 | |
| joined_at | timestamptz | 기존 | |
| **is_active** | **boolean** | **신규 추가** | **기관별 접근 권한 플래그. DEFAULT true** |

**Constraints**:
- 기관당 마지막 `owner` & `is_active=true` 멤버는 비활성화 불가 (애플리케이션 레벨 제약)
- 슈퍼 어드민(SUPER_ADMIN_EMAIL) 계정의 is_active는 변경 불가

**Migration**: `supabase/migrations/20260514000001_admin_panel.sql`

```sql
ALTER TABLE institution_members
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- is_active=false 멤버는 데이터 접근 불가 (RLS 업데이트)
-- 기존 데이터는 모두 is_active=true로 초기화됨 (DEFAULT)
```

---

## 신규 환경변수 (DB 스키마 외)

| 변수명 | 예시 | 설명 |
|---|---|---|
| `SUPER_ADMIN_EMAIL` | `mobys0416@gmail.com` | 슈퍼 어드민 이메일. 없으면 슈퍼 어드민 기능 비활성 |

---

## 쿠키 (세션 상태)

| 쿠키명 | 타입 | 설명 |
|---|---|---|
| `carelog_active_institution` | string (UUID) | 현재 활성 기관 institution_id. HttpOnly, 30일 만료 |

---

## 기존 테이블 변경 없음

- `institutions`: 변경 없음 (이미 name, type, created_at 보유)
- `institution_invitations`: 변경 없음

---

## 상태 전이: institution_members.is_active

```
신규 초대 수락
      │
      ▼
  is_active = true (기본)
      │
      │  관리자가 비활성화
      ▼
  is_active = false
      │  (해당 기관 데이터 접근 불가)
      │
      │  관리자가 재활성화
      ▼
  is_active = true
```

---

## 관계도

```
institutions (기관)
    │ 1
    │
    │ N
institution_members (기관-직원 연결)
    ├── institution_id → institutions.id
    ├── user_id → auth.users.id
    ├── role: owner | admin | staff
    └── is_active: true | false   ← 신규
```
