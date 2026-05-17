# Data Model: Carelog 환자 앱

**Feature**: 005-patient-app  
**Date**: 2026-05-17

---

## 기존 테이블 (변경 없음)

### patient_accounts
환자 영구 계정. `rrn_hash`가 신원 연결의 기준.

```
patient_accounts
  id            uuid PK
  rrn_hash      text UNIQUE NOT NULL   -- 주민번호 해시 (신원 식별자)
  created_at    timestamptz
  last_login_at timestamptz
```

### patient_sessions
OTP 기반 세션 (기존 환자 로그인 방식 유지).

```
patient_sessions
  id                 uuid PK
  patient_account_id uuid FK → patient_accounts(id)
  token              text UNIQUE
  expires_at         timestamptz  -- 30일
  created_at         timestamptz
```

### patient_account_links
patient_accounts ↔ patient (진료 기록) 매핑.

```
patient_account_links
  id                 uuid PK
  patient_account_id uuid FK → patient_accounts(id)
  patient_id         bigint FK → patient(id)
  institution_id     uuid FK → institutions(id)
  linked_at          timestamptz
  UNIQUE(patient_account_id, patient_id)
```

### patient_invitations
직원이 발행하는 SMS 초대 토큰.

```
patient_invitations
  id             uuid PK
  institution_id uuid FK → institutions(id)
  patient_id     bigint FK → patient(id)
  phone          text
  token          text UNIQUE
  consent_given  boolean
  invited_by     uuid FK → auth.users(id)
  expires_at     timestamptz  -- 72시간
  accepted_at    timestamptz
  created_at     timestamptz
```

---

## 신규 테이블

### patient_auth_links
Supabase auth.users ↔ patient_accounts 연결. Google OAuth 가입 시 생성.

```
patient_auth_links
  id                  uuid PK DEFAULT gen_random_uuid()
  auth_user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  patient_account_id  uuid NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE
  provider            text NOT NULL DEFAULT 'google'
  created_at          timestamptz NOT NULL DEFAULT now()
  UNIQUE(auth_user_id)               -- 하나의 Supabase 계정 → 하나의 환자 계정
  UNIQUE(patient_account_id, provider)  -- 동일 소셜 제공자로 중복 가입 방지
```

**관계**:
- `auth_user_id`: Supabase auth.users.id (Google OAuth 완료 시 생성)
- `patient_account_id`: 기존 OTP 인증으로 생성된 환자 계정
- `provider`: 현재 'google' 고정, 추후 'kakao' 추가 가능

**RLS**: 해당 `auth_user_id = auth.uid()`인 행만 SELECT 허용. INSERT/DELETE는 서비스 역할 키(admin client)만 허용.

### patient_push_subscriptions
환자 전용 Web Push 구독. OTP 세션 또는 Google 세션 모두 사용 가능.

```
patient_push_subscriptions
  id                  uuid PK DEFAULT gen_random_uuid()
  patient_account_id  uuid NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE
  endpoint            text NOT NULL
  p256dh              text NOT NULL
  auth                text NOT NULL
  created_at          timestamptz NOT NULL DEFAULT now()
  UNIQUE(patient_account_id, endpoint)
```

**관계**: `patient_account_id` 기반 — Supabase auth 세션 없어도 OTP 세션만으로 구독 등록 가능.

**RLS**: 서비스 역할 키(admin client)만 허용. 클라이언트는 Server Action을 통해서만 접근.

---

## 수정되는 함수

### getPatientSession() (lib/patient-session.ts)
기존 OTP 세션 쿠키 체크에 Supabase 인증 세션 폴백을 추가한다.

```
getPatientSession(cookies, supabaseServer?) → PatientSessionData | null

우선순위:
1. patient_session_token 쿠키 → patient_sessions 테이블 검증
2. supabase auth.uid() → patient_auth_links 조회 → patient_account_id 반환
```

---

## 엔티티 관계도

```
auth.users (Supabase)
    │
    ├── institution_members (직원 역할)
    │
    └── patient_auth_links ──── patient_accounts ─── patient_account_links ─── patient
                                      │                                              │
                                patient_sessions                             consultation
                                      │
                              patient_push_subscriptions
```

---

## 마이그레이션 파일

`supabase/migrations/20260517000002_patient_auth_links.sql`

```sql
-- patient_auth_links: Supabase auth user ↔ patient account
CREATE TABLE IF NOT EXISTS public.patient_auth_links (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_account_id  uuid NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  provider            text NOT NULL DEFAULT 'google',
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(auth_user_id),
  UNIQUE(patient_account_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_pal_auth_user ON public.patient_auth_links(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_pal_account   ON public.patient_auth_links(patient_account_id);

ALTER TABLE public.patient_auth_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient can read own auth link"
  ON public.patient_auth_links FOR SELECT
  USING (auth_user_id = auth.uid());

-- patient_push_subscriptions: patient web push
CREATE TABLE IF NOT EXISTS public.patient_push_subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_account_id  uuid NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  endpoint            text NOT NULL,
  p256dh              text NOT NULL,
  auth                text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_account_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_pps_account ON public.patient_push_subscriptions(patient_account_id);

ALTER TABLE public.patient_push_subscriptions ENABLE ROW LEVEL SECURITY;
-- 환자는 Server Action을 통해서만 접근 (admin client 사용)
```
