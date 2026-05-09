# 데이터베이스 스키마

Supabase(PostgreSQL) 기반. 전체 스키마는 `supabase/schema.sql` 참고.
마이그레이션 파일: `supabase/migrations/20260509000001_staff_auth_institution.sql`

## 테이블 목록

| 테이블 | 역할 |
|---|---|
| `institutions` | 의료기관 (다중 테넌트 루트) |
| `institution_members` | 기관-사용자 매핑 (역할 포함) |
| `institution_invitations` | 직원 초대 토큰 관리 |
| `patient` | 환자 기본 정보 (institution_id 필터) |
| `consultation` | 상담 기록 (patient 1:N, institution_id 필터) |

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
