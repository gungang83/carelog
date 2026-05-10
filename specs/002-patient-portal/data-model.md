# Data Model: 환자 포털

**Date**: 2026-05-10  
**Migration file**: `supabase/migrations/20260510000001_patient_portal.sql`

---

## 신규 테이블

### 1. `patient_invitations` — SMS 초대 기록

직원이 환자에게 발송한 초대 문자 기록. 72시간 유효 토큰 포함.

```sql
create table public.patient_invitations (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  patient_id     bigint not null references public.patient(id) on delete cascade,
  phone          text not null,
  token          text not null unique
    default replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  consent_given  boolean not null default false,
  invited_by     uuid not null references auth.users(id),
  expires_at     timestamptz not null default (now() + interval '72 hours'),
  accepted_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index idx_patient_invitations_token   on public.patient_invitations(token);
create index idx_patient_invitations_patient on public.patient_invitations(patient_id);
```

**상태 흐름**:
```
생성 → [accepted_at IS NULL, expires_at > now()] = 유효
     → [expires_at <= now()]                      = 만료
     → [accepted_at IS NOT NULL]                  = 수락 완료
```

**비즈니스 규칙**:
- 동일 `patient_id`에 재발송 시 기존 미수락 초대의 `expires_at`을 과거로 무효화 후 신규 생성
- `consent_given = false` 상태로는 SMS 발송 불가 (Server Action에서 검증)

---

### 2. `patient_accounts` — 환자 포털 계정

주민번호 해시 기반 환자 계정. Supabase Auth와 완전 분리.  
전화번호는 저장하지 않음 — OTP 전달 수단이며 변경 가능하므로 식별자 부적합.

```sql
create table public.patient_accounts (
  id            uuid primary key default gen_random_uuid(),
  rrn_hash      text not null unique,  -- SHA-256(정규화된 주민번호), 영구 식별자
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);
```

**비즈니스 규칙**:
- `rrn_hash`는 기존 `lib/rrn-hash.ts`의 `hashResidentNoForMatching()` 함수 결과와 동일 알고리즘
- `patient.resident_no_hash`와 동일한 해시값 → 크로스 기관 매칭 가능
- 전화번호가 바뀌어도 `rrn_hash`로 동일 계정 조회 가능
- 동일 주민번호 계정 중복 생성 불가 (`UNIQUE`)

---

### 3. `patient_otps` — OTP 인증 코드

전화번호 OTP 발송 및 검증 기록.

```sql
create table public.patient_otps (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  code          text not null,           -- 6자리 숫자
  expires_at    timestamptz not null default (now() + interval '5 minutes'),
  verified_at   timestamptz,
  attempt_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create index idx_patient_otps_phone on public.patient_otps(phone, expires_at);
```

**비즈니스 규칙**:
- 동일 전화번호 신규 OTP 요청 시 이전 미사용 OTP 무효화 (expires_at = now())
- `attempt_count >= 3` 이면 10분 잠금 (Server Action에서 검증)
- `verified_at IS NOT NULL` 이면 사용된 코드 → 재사용 불가

---

### 4. `patient_sessions` — 환자 세션 토큰

로그인 후 발급되는 세션 토큰. HttpOnly 쿠키로 클라이언트에 전달.

```sql
create table public.patient_sessions (
  id                 uuid primary key default gen_random_uuid(),
  patient_account_id uuid not null references public.patient_accounts(id) on delete cascade,
  token              text not null unique
    default replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  expires_at         timestamptz not null default (now() + interval '30 days'),
  created_at         timestamptz not null default now()
);

create index idx_patient_sessions_token on public.patient_sessions(token);
```

**비즈니스 규칙**:
- 쿠키명: `patient_session_token` (HttpOnly, Secure, SameSite=Lax)
- 만료된 세션은 미들웨어에서 무효 처리 → `/portal/login` 리다이렉트
- 로그아웃 시 DB에서 세션 레코드 삭제

---

### 5. `patient_account_links` — 계정 ↔ 환자 레코드 연결

PatientAccount와 기관별 patient 레코드의 M:N 연결.

```sql
create table public.patient_account_links (
  id                 uuid primary key default gen_random_uuid(),
  patient_account_id uuid not null references public.patient_accounts(id) on delete cascade,
  patient_id         bigint not null references public.patient(id) on delete cascade,
  institution_id     uuid not null references public.institutions(id) on delete cascade,
  linked_at          timestamptz not null default now(),
  unique(patient_account_id, patient_id)
);

create index idx_pal_account on public.patient_account_links(patient_account_id);
create index idx_pal_patient on public.patient_account_links(patient_id);
```

**비즈니스 규칙**:
- 초대 수락 시 자동 생성
- 동일 `(patient_account_id, patient_id)` 조합은 중복 불가
- 환자가 새 치과의 초대를 수락하면 새 row 추가 (기존 연결 유지)

---

## RLS 정책

환자 포털 테이블은 모두 Service Role Admin Client를 통해서만 접근.
일반 anon/authenticated 키로의 직접 접근 차단.

```sql
alter table public.patient_invitations    enable row level security;
alter table public.patient_accounts       enable row level security;
alter table public.patient_otps           enable row level security;
alter table public.patient_sessions       enable row level security;
alter table public.patient_account_links  enable row level security;

-- 모든 테이블: 직접 접근 차단 (Service Role만 통과)
-- RLS 정책 없음 = anon/authenticated 접근 불가
-- 모든 읽기/쓰기는 Server Action의 Admin Client를 통해서만
```

---

## 기존 테이블 변경사항

없음. 기존 `patient`, `consultation`, `institutions` 테이블 구조 변경 불필요.

---

## 엔티티 관계도

```
institutions ──< patient_invitations >── auth.users (invited_by)
     │                  │
     │              patient (patient_id)
     │                  │
     └──── patient_account_links ────> patient_accounts
                        │                     │
                    institution_id        patient_sessions
                    patient_id
```

---

## 환경변수 추가

| 변수 | 용도 |
|---|---|
| `SOLAPI_API_KEY` | Solapi API 키 |
| `SOLAPI_API_SECRET` | Solapi API 시크릿 |
| `SOLAPI_SENDER_PHONE` | 발신 번호 (사전 등록된 번호) |
