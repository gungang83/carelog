# 데이터베이스 스키마

Supabase(PostgreSQL) 기반. 전체 스키마는 `supabase/schema.sql` 참고.

마이그레이션 파일:
- `supabase/migrations/20260509000001_staff_auth_institution.sql`
- `supabase/migrations/20260510000001_patient_portal.sql`
- `supabase/migrations/20260517000001_push_subscriptions.sql`
- `supabase/migrations/20260517000002_patient_auth_links.sql`
- `supabase/migrations/20260515000001_activity_logs.sql`
- `supabase/migrations/20260526000001_chair_quick_record.sql`
- `supabase/migrations/20260601000001_activity_log_patient_sync.sql`
- `supabase/migrations/20260607000001_clinic_members.sql`
- `supabase/migrations/20260608000001_eo_integration.sql` — EO 게이트웨이 마스터 캐시 + SSO 작성자 귀속 (카드 235)

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
| `activity_logs` | 최근 활동 피드용 상담 이벤트 로그 (트리거 자동 기록) |
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
| `plan` | text DEFAULT 'free' | 요금/기능 게이트 단일 출처 |
| `lab_enabled` | boolean NOT NULL DEFAULT false | 녹음 엔진 실험실 게이트 — true면 상담별 엔진 picker 노출(예미안 한정). 비-lab은 'basic' 강제 |
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
| `is_active` | boolean NOT NULL DEFAULT true | 접근 활성 여부 (migration 20260514000001) |
| `eo_employee_id` | uuid | EO SSO `employee_id` — 공용계정이면 NULL (migration 20260608000001) |
| `display_name` | text | EO SSO `name` — 상담 작성자 표시명 (migration 20260608000001) |

**제약**
- UNIQUE(institution_id, user_id) — 동일 기관 중복 멤버 방지

> **EO SSO 보정 (카드 235)**: `/api/auth/sso`가 확장 클레임(`employee_id`·`name`·`account_type`·`eo_role`)을 받아
> 신규 멤버는 매핑된 role(`clinic_admin`→`admin`, 그 외 `staff`)로 추가하고, 기존 멤버는 role을 건드리지 않고
> `eo_employee_id`·`display_name`만 갱신한다(수동 조정 권한 보호). 이 두 컬럼이 상담 작성자 귀속 체인의 토대다.

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
| `participants` | jsonb NOT NULL DEFAULT `[]` | 상담 참여자 스냅샷 `[{id,name,role}]` (migration 20260607000001). 이름 변경/EO 이관에도 기록 시점 보존 |
| `author_employee_id` | uuid | 작성자 EO 직원 id (있으면). 저장 시 세션 멤버에서 자동 기록 (migration 20260608000001) |
| `author_name` | text | 작성자 표시명 (공용계정 포함). display_name 없으면 이메일 폴백 (migration 20260608000001) |
| `transcription_engine` | text | 그 기록을 만든 녹음 엔진 — `basic`/`multilingual` (null=레거시·수동). 실험실 평가·비교 데이터 (migration 20260624000001) |
| `created_at` | timestamptz | 기록 시각 |

> **작성자 귀속 (카드 235)**: `saveConsultation`·`saveChairRecord` 저장 시 `getMyAuthorInfo()`로 세션 멤버의
> `eo_employee_id`·`display_name`을 읽어 위 두 컬럼에 기록한다. 공용계정(`account_type='shared'`)도 표시명은 남긴다.
> **상담 데이터는 Carelog 내부에만 저장되며 EO로 나가지 않는다(계약 §4 의료데이터 격리 — 상담 EO API 없음).**

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

## `clinic_members` *(migration 20260607000001 + EO 캐시 20260608000001)*

워크스페이스 참여자(원장·직원·담당자) 디렉터리. 체어와 동일 패턴. 녹음 시작 시 참여자 선택용.
**EO↔Carelog 연동(카드 235)부터 이 테이블이 EO 직원 마스터의 로컬 캐시(읽기 사본)를 겸한다.**
EO에서 받은 행은 `source='eo'`, 설정에서 직접 등록한 행은 `source='manual'`로 구분한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `institution_id` | uuid NOT NULL FK → institutions.id | 소속 기관 (CASCADE DELETE) |
| `name` | text NOT NULL | 멤버 이름 (환자 화면엔 마스킹: 송정훈 → 송정*) |
| `role` | text | 역할 표기 (EO source는 position 우선 노출) |
| `display_order` | integer NOT NULL DEFAULT 0 | 정렬 순서 |
| `is_active` | boolean NOT NULL DEFAULT true | 활성 여부 (EO active=false/퇴사·is_draft=true/미승인이면 false) |
| `created_at` | timestamptz | 생성 시각 |
| `eo_employee_id` | uuid | EO `members[].id` — upsert 키(불변). manual 행은 NULL (migration 20260608000001) |
| `email` | text | EO 직원 이메일 |
| `eo_role` | text | EO 역할: `clinic_admin` / `manager` / `staff` |
| `position` | text | EO 직책 (예: 치과위생사) |
| `source` | text NOT NULL DEFAULT 'manual' | `'manual'`(수동) / `'eo'`(게이트웨이 동기화). CHECK 제약 |
| `synced_at` | timestamptz | 마지막 EO 동기화 시각 |

**제약/인덱스**
- (구) `UNIQUE(institution_id, name)` 제약은 **완화** — EO 동명이인 대비. 대신 부분 unique:
  - `clinic_members_manual_name_uidx` — `(institution_id, name) WHERE source='manual'` (수동분만 이름 중복 방지)
  - `clinic_members_eo_employee_uidx` — `(institution_id, eo_employee_id) WHERE eo_employee_id IS NOT NULL` (EO upsert 키)
- `idx_clinic_members_institution`

**RLS**: 직원 SELECT / admin·owner ALL (chairs와 동일 구조). EO 동기화는 admin(service role) 클라이언트로 RLS 우회.

**동기화 규칙(계약 §1, `lib/eo/sync-master.ts`)**: EO 응답 `members[]`를 `eo_employee_id` 키로 upsert(`source='eo'`).
응답에 없는 **EO-source** 행은 `is_active=false`. **`source='manual'` 행은 절대 건드리지 않는다(수동 추가분 보호).**

---

## `chair_audit_logs` *(신규 — migration 20260526000001)*

체어 기록 감사 로그. **INSERT 전용 — UPDATE/DELETE 정책 없음 (불변)**.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `institution_id` | uuid NOT NULL FK → institutions.id | 소속 기관 (CASCADE DELETE) |
| `chair_id` | uuid FK → chairs.id | 관련 체어 (SET NULL on delete) |
| `consultation_id` | uuid FK → consultation.id | 관련 상담 기록 (SET NULL on delete) |
| `event_type` | text NOT NULL | `record_created` / `record_transcribed` / `record_edited` / `patient_linked` / `patient_unlinked` / `patient_relinked` / `record_deleted` |
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

## `activity_logs` *(migration 20260515000001 + 20260601000001)*

홈 "최근 활동" 피드용 상담 이벤트 로그. 트리거로 자동 기록된다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | |
| `institution_id` | uuid NOT NULL | 기관 |
| `event_type` | text | `consultation.created` |
| `patient_id` | bigint | 연결 환자 (NULL이면 피드에 미노출) |
| `consultation_id` | bigint | 상담 |
| `metadata` | jsonb | `content_preview` 등 |
| `created_at` | timestamptz | |

**트리거 (20260601000001에서 개정)**

- `trg_consultation_created_log` (AFTER INSERT): `patient_id`가 있을 때만 로그 기록.
  **미연결 체어 draft(patient_id NULL)는 활동 피드에서 제외.**
- `trg_consultation_patient_changed_log` (AFTER UPDATE OF patient_id): 체어 기록의
  환자 **연결/재연결/해제** 시 활동로그를 동기화한다. 연결되면 `created_at=now()`로 새 로그를
  기록(최근 활동 상단 노출), 해제(NULL)되면 로그 삭제.

> 개정 배경: 체어 즉시 기록은 `patient_id=NULL`(draft)로 먼저 insert되어 INSERT 트리거만으로는
> 연결 후에도 활동 피드가 "알 수 없는 환자"로 남고 클릭이 안 되던 버그를 해결.

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
| `CARELOG_SSO_SECRET` | EO SSO JWT 서명 검증 (EO와 공유, HS256) |
| `CARELOG_GATEWAY_SECRET` | EO 마스터 게이트웨이 서버-서버 인증 (`x-gateway-secret` 헤더). EO·CL 양쪽 Vercel에 동일 등록 (카드 235) |
| `EO_APP_URL` | EO 앱 베이스 URL (기본값 `https://eo-ten.vercel.app`) |
| `CRON_SECRET` | (선택) `/api/cron/sync-master` 보호 — `Authorization: Bearer <secret>` |

---

## 마이그레이션 규칙

1. 스키마 변경 시 `supabase/schema.sql`을 **반드시** 함께 수정
2. 신규 마이그레이션은 `supabase/migrations/YYYYMMDDHHMMSS_description.sql`로 추가
3. 운영 DB에 직접 DDL 실행 후 schema.sql 업데이트 누락 금지
4. 컬럼 추가는 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 패턴 사용

## Realtime (spec 007 — 실시간 체어 알림)

- **`chair_audit_logs`** 가 `supabase_realtime` publication에 포함된다(migration `20260614000001_realtime_chair_audit_logs.sql`).
- 클라이언트(직원 화면)는 이 테이블의 `INSERT`를 `institution_id` 필터로 구독해 새 체어 상담기록 도착을 실시간 인지한다.
- **진료 본문이 든 `consultation`은 의도적으로 realtime 구독 대상이 아니다** — 전송선에 PII/진료내용이 실리지 않도록(헌법 I). 목록 실제 데이터는 `router.refresh()`로 서버에서 RLS 경유 재조회.
- 격리: 채널 필터 + RLS("staff reads own institution audit logs") 이중.

## 음성 원본 보관 (spec 009-audio-archive)
- `institutions.plan` (free|standard|pro|enterprise, 기본 free) — 요금 등급·기능 게이트 단일 출처(`docs/pricing-tiers.md`).
- `consultation.audio_path`·`audio_uploaded_at` — 비공개 버킷 경로/업로드시각. 음성 삭제 시 null(텍스트는 보존).
- `audio_replay_logs` (institution_id·consultation_id·user_id·played_at) — Pro 이상 재청취 감사. chair_audit_logs와 분리(realtime 오발 방지).
- 비공개 Storage 버킷 `consultation-audio`(public=false) — 서명 URL(60초)로만 접근. 업로드/삭제/서명은 Server Action(service role).
- 보존: free=최근3 롤링 / standard=90일 / pro·enterprise=365일+. 정리: free는 업로드 시, 기간은 cron `/api/cron/prune-audio`(일1회).
- migration: `20260619000001_audio_archive.sql`

## 알림함 (spec 012-notification-inbox)
- `notifications` (institution_id·created_at·title·body·type·link·recipients·created_by) — broadcast 알림 본문. recipients = 'all' | 'admins' | 이메일.
- `notification_reads` (notification_id→notifications cascade·user_id·created_at, unique(notification_id,user_id)) — **유저별 읽음 = 행 존재**. 읽음=upsert, 안읽음=delete.
- RLS: notifications select = 같은 기관 멤버(`get_my_institution_id()`, realtime 구독도 이 정책) / notification_reads = 본인(`auth.uid()`)만. 적재·조회는 service role(서버).
- Realtime: `notifications`를 supabase_realtime publication에 추가(새 알림 즉시 반영).
- 적재: `lib/notifications.ts` `sendNotification`(알림 insert + 기존 웹푸시 통합) — `chairs.saveChairRecord`·`consultations.saveConsultation`에서 호출. 환자 PII 평문 미적재.
- migration: `20260628000001_notifications.sql`

## 사용량·크레딧 (spec 013-usage-credit-dashboard)
- `menu_usage_daily` (institution_id·user_email·menu_id·day·role_snap·count, unique(institution_id,user_email,menu_id,day)) — 화면 진입 **일별 집계**(클릭당 row 폭증 방지). `increment_menu_usage` RPC로 원자적 +1(KST 일자).
- `institution_credits` (institution_id PK·balance·updated_at) — 기관 크레딧 잔액(시뮬레이션, **음수 허용**).
- `credit_log` (institution_id·delta·feature·ref_id·balance_after·memo·created_by·created_at) — 차감/충전 원장(누가·얼마·어떤 기능). delta<0=차감, >0=충전(grant).
- RPC: `increment_menu_usage`(SECURITY DEFINER) / `deduct_credit`(★비차단 — 잔액 부족해도 차감·기록, 차감 후 잔액) / `grant_credit`(충전 + grant 로그).
- RLS: 세 테이블 **enable + 정책 0개** → 클라(anon/authenticated) 전면 차단, service_role(admin client)만 접근. 기관 격리는 조회 쿼리 institution_id 필터. 환자 PII 미적재(직원 이메일·메뉴·기능만).
- 배선: `app/actions/transcribe.ts` `recordUsage`(비차단) → `deduct_credit`. 메뉴는 `components/usage/route-tracker.tsx` → `POST /api/menu-usage/track`. 단가 출처 `lib/credits.ts` CREDIT_PRICES.
- migration: `20260628000002_usage_credits.sql`

## 일일 사용 리포트 (spec 014-daily-usage-report)
- `credit_log` 확장: `tokens_in`·`tokens_out` (integer, default 0) — Claude 응답 usage 실토큰. `deduct_credit`이 6-arg→8-arg(토큰)로 재생성(여전히 비차단).
- `usage_reports` (report_date·scope·payload jsonb·created_at, unique(report_date,scope)) — 일별 리포트 **스냅샷**(멱등 발행·과거 열람). scope='all'(전체) | institution_id(운영자). RLS enable + 정책0(service_role만).
- 집계: `lib/usage/daily-report.ts` `buildDailyReport({date,scope})` — **KST 0~24시**(menu_usage_daily.day + credit_log created_at 경계). 전일 대비·경고 포함.
- 발행: cron `/api/cron/daily-usage-report`(매일 08:00 KST = `0 23 * * *`). 슈퍼어드민 알림함(recipients=email) + `sendPushToUser`(본인 기기). 열람 `/admin/usage/report/[date]`. 운영자(기관)별 발송(spec 019): 활동 기관마다 recipients:'admins'(push 억제) + `/reports/daily/[date]`.

## 일일 서버(인프라) 리포트 (spec 018-infra-daily-report)
- `get_infra_usage()` SECURITY DEFINER — storage.objects 버킷별 용량·객체수 + pg_database_size. service_role만. 일일 리포트 인프라 섹션이 사용. migration: `20260629000001_infra_usage.sql`

## 서버 비동기 전사 (spec 020-server-async-transcription)
- `transcription_jobs` (institution_id·consultation_id→consultation cascade·engine·prefix_html·status(pending/processing/done/error)·attempts·error·created_by·created/updated_at) — '상담 종료 및 저장' 시 등록되는 전사 작업 큐. RLS enable+정책0(service_role만).
- 흐름: `enqueueServerTranscription`(플레이스홀더 상담 '전사 중' 생성 + 음성 업로드 + job) → 워커 cron `/api/cron/process-transcriptions`(매 분, 원자 클레임 → 음성 다운로드 → `runServerTranscription` → content 갱신 → done → deductCredit → 완료 알림). 3회 재시도 후 error(음성 보관·재시도).
- migration: `20260629000002_transcription_jobs.sql`

## 확인 꼬리표 (spec 021-review-flags)
- `consultation_review_flags` — 상담 카드에 다는 '확인 필요' 태그. 담당이 정리 내용을 차트에 이관하기 전 확인할 항목(환자·참여자·장소·내용 등) 추적.
  - 컬럼: `id`(uuid pk) · `institution_id`(uuid→institutions cascade) · `consultation_id`(**bigint**→consultation cascade) · `type`(text: patient/participants/location/content/other, 코드 config로 확장) · `note`(text) · `status`(text default 'open' → 'resolved') · `created_by`(text) · `created_at` · `resolved_by`(text) · `resolved_at`.
  - 인덱스: `(consultation_id)` · `(institution_id, status)`.
  - RLS: 멤버십 기반 — `institution_id in (select public.my_institution_ids())` using/with check(소속 기관 멤버 읽기/쓰기).
  - 배선: 서버액션 `app/actions/review-flags.ts`(`getReviewFlagsFor` 일괄조회·`addReviewFlag`·`resolveReviewFlag`·`deleteReviewFlag`). UI `components/consultation/review-flags.tsx`(공용 카드 하단 칩). 타입 정의 `lib/review-flags.ts`.
- migration: `20260705000001_review_flags.sql` (my_institution_ids()는 20260629000003에서 생성됨)

## 공지·업데이트 (spec 022-announcements)
- `announcements` — 중앙(슈퍼어드민)이 전 기관에 내보내는 **전역** 공지. 알림함(`notifications`, 기관별)과 달리 institution_id **없음** — 한 번 발행하면 모든 워크스페이스 공통.
  - 컬럼: `id`(uuid pk) · `title`(text, 티커 한 줄) · `body`(text, 상세) · `link`(text) · `level`(text default 'update': update/notice/info) · `active`(bool default true) · `pinned`(bool default false) · `starts_at`/`ends_at`(timestamptz, 노출기간) · `created_by`(text) · `created_at`.
  - 인덱스: `(active, created_at desc)`.
  - RLS: **직원(authenticated) read** — `active and (starts_at is null or ≤ now()) and (ends_at is null or ≥ now())`. **발행/수정은 service_role**(정책 없음 → 클라 쓰기 차단, 슈퍼어드민 서버액션이 admin 클라로 우회).
  - 배선: `app/actions/announcements.ts`(`getActiveAnnouncements` 직원 read + 슈퍼어드민 CRUD, isSuperAdmin 가드). UI 티커 `components/announcements/announcement-ticker.tsx`, 전체보기 `/announcements`, 발행 `/admin/announcements`. 타입 `lib/announcements.ts`.
- migration: `20260705000002_announcements.sql`

## 업데이트 피드 (spec 023-update-feed)
- `update_feed_decisions` — 슈퍼어드민 전용 업데이트 피드의 **결정 상태**. 피드 자체(업데이트 내역)는 DB가 아니라 레포 코드 `lib/update-feed.ts` `UPDATE_FEED`에 세션 마무리마다 append(배포와 함께 쌓임).
  - 컬럼: `entry_id`(text pk, 피드 엔트리 id) · `status`(text: published/dismissed) · `announcement_id`(uuid → announcements, on delete set null) · `decided_at`(timestamptz default now()).
  - RLS: **enable + 정책 0개(deny-all)** — authenticated 전면 차단, 서버액션(service_role + isSuperAdmin 가드)만 read/write. 일반 직원에게는 존재 자체가 보이지 않음.
  - 배선: `app/actions/update-feed.ts`(`getUpdateFeed`·`publishUpdateAnnouncement`·`dismissUpdateEntries`·`clearUpdateDecision`). UI `/admin/updates` + `components/admin/update-feed-manager.tsx`.
- migration: `20260705000003_update_feed.sql`

## 상담 이미지 라이브러리 (spec 025-consult-assets)
- `consult_assets` — 기관이 미리 등록하는 상담 설명 자료(에디터 픽커로 삽입). institution_id **nullable**(null=전역 Carelog 제공 — v1 미사용, 후속 확장용).
  - 컬럼: `id`(uuid pk) · `institution_id`(uuid → institutions cascade) · `title` · `category`(text, `lib/consult-assets.ts` config: implant/endo/prosth/ortho/perio/prevent/appliance/general) · `image_url`(text, `consult-assets` 공개 버킷) · `caption`(text, 삽입 시 동반 문구) · `display_order` · `active` · `created_by` · `created_at`.
  - RLS: read = 자기 기관 멤버십 + 활성 전역 / write = owner·admin 멤버십(전역 write는 service_role만).
  - 업로드: 클라 압축(webp, spec 017) → 서버액션 FormData → service_role 업로드(storage 정책 불필요). **삭제 시 스토리지 원본 보존**(기존 상담 기록 이미지 URL 보호).
- storage bucket: `consult-assets` (public read).
- migration: `20260708000001_consult_assets.sql`
