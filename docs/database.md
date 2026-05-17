# 데이터베이스 스키마

Supabase(PostgreSQL) 기반. 전체 스키마는 `supabase/schema.sql` 참고.

마이그레이션 파일:
- `supabase/migrations/20260509000001_staff_auth_institution.sql`
- `supabase/migrations/20260510000001_patient_portal.sql`
- `supabase/migrations/20260517000001_push_subscriptions.sql`

## 테이블 목록

| 테이블 | 역할 |
|---|---|
| `institutions` | 의료기관 (다중 테넌트 루트) |
| `institution_members` | 기관-사용자 매핑 (역할 포함) |
| `institution_invitations` | 직원 초대 토큰 관리 |
| `patient` | 환자 기본 정보 (institution_id 필터) |
| `consultation` | 상담 기록 (patient 1:N, institution_id 필터) |
| `patient_invitations` | 환자 포털 SMS 초대 기록 (72시간 유효) |
| `patient_accounts` | 환자 포털 계정 (주민번호 해시 기반, Supabase Auth 분리) |
| `patient_otps` | 환자 OTP 인증 코드 (5분 만료) |
| `patient_sessions` | 환자 세션 토큰 (30일 HttpOnly 쿠키) |
| `patient_account_links` | PatientAccount ↔ 기관 내 patient 레코드 M:N 연결 |
| `push_subscriptions` | Web Push 구독 정보 (기기별 VAPID 엔드포인트) |

---

## `institutions`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `name` | text NOT NULL | 기관명 (예: 예미안치과) |
| `type` | text NOT NULL DEFAULT 'dental' | 기관 유형 |
| `created_at` | timestamptz | 생성 시각 |

---

## `institution_members`

기관과 auth.users를 연결하는 멤버십 테이블.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `institution_id` | uuid FK → institutions.id | 소속 기관 (CASCADE DELETE) |
| `user_id` | uuid FK → auth.users.id | Supabase Auth 사용자 (CASCADE DELETE) |
| `role` | text NOT NULL DEFAULT 'staff' | 역할: `owner` / `admin` / `staff` |
| `invited_by` | uuid FK → auth.users.id | 초대한 사용자 |
| `joined_at` | timestamptz | 가입 시각 |

**제약**
- UNIQUE(institution_id, user_id) — 동일 기관 중복 멤버 방지

**인덱스**
- `idx_inst_members_user` — user_id
- `idx_inst_members_inst` — institution_id

---

## `institution_invitations`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `institution_id` | uuid FK → institutions.id | 초대한 기관 (CASCADE DELETE) |
| `email` | text NOT NULL | 초대 대상 이메일 |
| `role` | text NOT NULL DEFAULT 'staff' | 부여할 역할 |
| `token` | text UNIQUE | 64자 랜덤 토큰 (UUID × 2, 하이픈 제거) |
| `invited_by` | uuid FK → auth.users.id | 초대한 사용자 |
| `expires_at` | timestamptz | 만료 시각 (기본: +24시간) |
| `accepted_at` | timestamptz | 수락 시각 (NULL = 미수락) |
| `created_at` | timestamptz | 생성 시각 |

**인덱스**
- `idx_inst_invitations_token` — token (초대 링크 조회용)

---

## `patient`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | bigint PK | 자동 증가 |
| `institution_id` | uuid NOT NULL FK → institutions.id | 소속 기관 |
| `name` | text NOT NULL | 환자 이름 |
| `chart_no` | text | 차트 번호 (병원 내부 ID) |
| `phone` | text | 연락처 |
| `resident_no` | text | 주민등록번호 (XXXXXX-XXXXXXX 형식, UI에서 마스킹) |
| `resident_no_hash` | text | SHA-256 해시 — unique index, 중복 환자 방지 |
| `created_at` | timestamptz | 등록 시각 |

**인덱스**
- `patient_resident_no_hash_uidx` — `resident_no_hash` WHERE NOT NULL

**RLS 정책**
```sql
create policy "staff sees own institution patients" on public.patient
  for all
  using (institution_id = public.get_my_institution_id())
  with check (institution_id = public.get_my_institution_id());
```

---

## `consultation`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `institution_id` | uuid NOT NULL FK → institutions.id | 소속 기관 |
| `patient_id` | bigint FK → patient.id | 연결 환자 (CASCADE DELETE) |
| `content` | text | 상담 내용 |
| `image_urls` | jsonb | 이미지 URL 배열 (`["url1", "url2"]`) |
| `prescriptions` | jsonb | 처방 메모 배열 |
| `station_name` | text | 작성한 체어 번호 |
| `created_at` | timestamptz | 기록 시각 |

**인덱스**
- `consultation_patient_id_idx` — patient_id 검색 최적화

**RLS 정책**
```sql
create policy "staff sees own institution consultations" on public.consultation
  for all
  using (institution_id = public.get_my_institution_id())
  with check (institution_id = public.get_my_institution_id());
```

---

## RLS 헬퍼 함수

```sql
create or replace function public.get_my_institution_id()
returns uuid language sql security definer stable as $$
  select institution_id
  from public.institution_members
  where user_id = auth.uid()
  limit 1;
$$;
```

`security definer` + `stable`로 선언하여 RLS 정책 내에서 효율적으로 호출됨.

---

## 환자 포털 테이블 (마이그레이션: 20260510000001)

모든 환자 포털 테이블은 RLS 활성화 + 정책 없음 = anon/authenticated 키 접근 불가.
모든 읽기/쓰기는 Service Role Admin Client를 통해서만.

## `patient_invitations`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `institution_id` | uuid FK → institutions.id | 발송 기관 |
| `patient_id` | bigint FK → patient.id | 대상 환자 |
| `phone` | text NOT NULL | 수신 전화번호 (정규화: 010XXXXXXXX) |
| `token` | text UNIQUE | 64자 랜덤 토큰 (UUID × 2 연결) |
| `consent_given` | boolean NOT NULL | 개인정보 제공 동의 여부 |
| `invited_by` | uuid FK → auth.users.id | 발송한 직원 |
| `expires_at` | timestamptz | 만료 시각 (기본: +72시간) |
| `accepted_at` | timestamptz | 수락 시각 (NULL = 미수락) |
| `created_at` | timestamptz | 생성 시각 |

**인덱스**: `idx_patient_invitations_token`, `idx_patient_invitations_patient`

---

## `patient_accounts`

주민번호 해시 기반 환자 포털 계정. 전화번호 저장 없음.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `rrn_hash` | text NOT NULL UNIQUE | SHA-256(pepper+정규화된_주민번호) — 영구 식별자 |
| `created_at` | timestamptz | 가입 시각 |
| `last_login_at` | timestamptz | 마지막 로그인 |

---

## `patient_otps`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `phone` | text NOT NULL | OTP 수신 전화번호 |
| `code` | text NOT NULL | 6자리 숫자 코드 |
| `expires_at` | timestamptz | 만료 시각 (기본: +5분) |
| `verified_at` | timestamptz | 인증 완료 시각 (NULL = 미사용) |
| `attempt_count` | integer NOT NULL | 오류 시도 횟수 (3회 초과 시 10분 잠금) |
| `created_at` | timestamptz | 생성 시각 |

**인덱스**: `idx_patient_otps_phone`

---

## `patient_sessions`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `patient_account_id` | uuid FK → patient_accounts.id | 연결 계정 |
| `token` | text UNIQUE | 64자 랜덤 토큰 — HttpOnly 쿠키 값 |
| `expires_at` | timestamptz | 만료 시각 (기본: +30일) |
| `created_at` | timestamptz | 생성 시각 |

**인덱스**: `idx_patient_sessions_token`

---

## `patient_account_links`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `patient_account_id` | uuid FK → patient_accounts.id | 환자 포털 계정 |
| `patient_id` | bigint FK → patient.id | 기관 내 환자 레코드 |
| `institution_id` | uuid FK → institutions.id | 기관 |
| `linked_at` | timestamptz | 연결 시각 |

**제약**: UNIQUE(patient_account_id, patient_id)
**인덱스**: `idx_pal_account`, `idx_pal_patient`

---

## Storage

| 버킷 | 공개 여부 | 용도 |
|---|---|---|
| `consultation-images` | Public | 상담 이미지 업로드/조회 |

버킷명은 환경변수 `NEXT_PUBLIC_SUPABASE_CONSULTATION_BUCKET`으로 오버라이드 가능.

---

## 환경변수

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role 키 (서버 전용, RLS 우회) |
| `NEXT_PUBLIC_SITE_URL` | 이메일 인증 리다이렉트 기준 URL |

---

## 마이그레이션 규칙

1. 스키마 변경 시 `supabase/schema.sql`을 **반드시** 함께 수정
2. 신규 마이그레이션은 `supabase/migrations/YYYYMMDDHHMMSS_description.sql`로 추가
3. 운영 DB에 직접 DDL 실행 후 schema.sql 업데이트 누락 금지
4. 컬럼 추가는 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 패턴 사용
