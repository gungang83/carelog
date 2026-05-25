# 데이터베이스 스키마

Supabase(PostgreSQL) 기반. 전체 스키마는 `supabase/schema.sql` 참고.

마이그레이션 파일:
- `supabase/migrations/20260509000001_staff_auth_institution.sql`
- `supabase/migrations/20260510000001_patient_portal.sql`
- `supabase/migrations/20260517000001_push_subscriptions.sql`
- `supabase/migrations/20260526000001_chair_quick_record.sql`

## 테이블 목록

| 테이블 | 역할 |
|---|---|
| `institutions` | 의료기관 (다중 테넌트 루트) |
| `institution_members` | 기관-사용자 매핑 (역할 포함) |
| `institution_invitations` | 직원 초대 토큰 관리 |
| `patient` | 환자 기본 정보 (institution_id 필터) |
| `consultation` | 상담 기록 (patient 1:N, institution_id 필터; patient_id nullable — 체어 임시 기록) |
| `chairs` | 진료 공간 단위 (A/B/C 등), 기관별 관리 |
| `chair_audit_logs` | 체어 기록 감사 로그 (삽입 전용, 불변) |
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

`patient_id`는 nullable — 체어 즉시 기록 시 환자 미연결 상태로 저장, 이후 연결.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `institution_id` | uuid NOT NULL FK → institutions.id | 소속 기관 |
| `patient_id` | bigint FK → patient.id | 연결 환자 (CASCADE DELETE). **NULL 허용** — 체어 임시 기록 |
| `content` | text | 상담 내용 |
| `image_urls` | jsonb | 이미지 URL 배열 (`["url1", "url2"]`) |
| `prescriptions` | jsonb | 처방 메모 배열 |
| `station_name` | text | 작성한 체어 번호 (레거시, 신규는 chair_id 사용) |
| `status` | text | `'draft'` (임시) / `'confirmed'` (확정). DEFAULT 'confirmed' |
| `sms_sent_at` | timestamptz | 환자 SMS 발송 시각 |
| `chair_id` | uuid FK → chairs.id | 체어 임시 기록 시 사용 (SET NULL on delete) |
| `linked_at` | timestamptz | 환자 연결 완료 시각 |
| `linked_by` | uuid FK → auth.users.id | 환자 연결 처리한 직원 |
| `created_at` | timestamptz | 기록 시각 |

**인덱스**
- `consultation_patient_id_idx` — patient_id 검색 최적화
- `idx_consultation_chair` — chair_id WHERE NOT NULL

**RLS 정책**
```sql
create policy "staff sees own institution consultations" on public.consultation
  for all
  using (institution_id = public.get_my_institution_id())
  with check (institution_id = public.get_my_institution_id());
```

---

## `chairs` *(신규 — migration 20260526000001)*

기관 내 진료 공간(체어) 목록. 기본값 A/B/C 자동 시드.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `institution_id` | uuid NOT NULL FK → institutions.id | 소속 기관 (CASCADE DELETE) |
| `name` | text NOT NULL | 체어 표시명 (예: A, B, C) |
| `display_order` | integer NOT NULL DEFAULT 0 | 정렬 순서 |
| `is_active` | boolean NOT NULL DEFAULT true | 활성 여부 |
| `created_at` | timestamptz | 생성 시각 |

**제약**: UNIQUE(institution_id, name)
**인덱스**: `idx_chairs_institution`

**RLS 정책**
```sql
-- 직원: SELECT
create policy "staff reads own institution chairs" on public.chairs
  for select using (institution_id = public.get_my_institution_id());
-- 관리자: ALL (admin/owner만)
create policy "admin manages chairs" on public.chairs
  for all using (
    institution_id = public.get_my_institution_id()
    and exists (
      select 1 from public.institution_members
      where user_id = auth.uid()
        and institution_id = public.get_my_institution_id()
        and role in ('admin', 'owner')
    )
  );
```

---

## `chair_audit_logs` *(신규 — migration 20260526000001)*

체어 기록 감사 로그. **INSERT 전용 — UPDATE/DELETE 정책 없음 (불변)**.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `institution_id` | uuid NOT NULL FK → institutions.id | 소속 기관 (CASCADE DELETE) |
| `chair_id` | uuid FK → chairs.id | 관련 체어 (SET NULL on delete) |
| `consultation_id` | uuid FK → consultation.id | 관련 상담 기록 (SET NULL on delete) |
| `event_type` | text NOT NULL | `record_created` / `record_transcribed` / `record_edited` / `patient_linked` / `record_deleted` |
| `actor_user_id` | uuid NOT NULL FK → auth.users.id | 작업 수행 직원 |
| `patient_id_before` | bigint | 환자 연결 변경 전 patient_id |
| `patient_id_after` | bigint | 환자 연결 변경 후 patient_id |
| `metadata` | jsonb NOT NULL DEFAULT '{}' | 추가 컨텍스트 |
| `created_at` | timestamptz | 이벤트 발생 시각 |

**인덱스**: `idx_cal_institution`, `idx_cal_chair`, `idx_cal_consultation`

**RLS 정책**
```sql
-- SELECT: 소속 기관 직원
create policy "staff reads own institution audit logs" on public.chair_audit_logs
  for select using (institution_id = public.get_my_institution_id());
-- INSERT: 소속 기관 직원 본인 actor만
create policy "staff inserts audit logs" on public.chair_audit_logs
  for insert with check (
    institution_id = public.get_my_institution_id()
    and actor_user_id = auth.uid()
  );
-- UPDATE/DELETE 정책 없음 → 레코드 불변 보장
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

## `patient_auth_links` *(신규 — migration 20260517000002)*

Supabase auth.users와 patient_accounts를 연결. Google OAuth 가입 시 생성.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `auth_user_id` | uuid FK → auth.users(id) CASCADE | Supabase 인증 사용자 ID |
| `patient_account_id` | uuid FK → patient_accounts(id) CASCADE | 환자 포털 계정 |
| `provider` | text NOT NULL DEFAULT 'google' | 소셜 제공자 (현재 'google') |
| `created_at` | timestamptz | 생성 시각 |

**제약**: UNIQUE(auth_user_id), UNIQUE(patient_account_id, provider)
**인덱스**: `idx_pal_auth_user`, `idx_pal_patient_account`
**RLS**: SELECT — auth_user_id = auth.uid(). INSERT/DELETE — admin client 전용.

---

## `patient_push_subscriptions` *(신규 — migration 20260517000002)*

환자 전용 Web Push 구독. OTP 세션 또는 Google 세션 모두 지원.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `patient_account_id` | uuid FK → patient_accounts(id) CASCADE | 환자 포털 계정 |
| `endpoint` | text NOT NULL | Push 구독 endpoint URL |
| `p256dh` | text NOT NULL | ECDH 공개 키 |
| `auth` | text NOT NULL | 인증 비밀 |
| `created_at` | timestamptz | 생성 시각 |

**제약**: UNIQUE(patient_account_id, endpoint)
**인덱스**: `idx_pps_account`
**RLS**: enabled, 정책 없음 (admin client만 접근 가능)

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
