# 데이터베이스 스키마

Supabase(PostgreSQL) 기반. 전체 스키마는 `supabase/schema.sql` 참고.

## 테이블 목록

| 테이블 | 역할 |
|---|---|
| `patient` | 환자 기본 정보 |
| `consultation` | 상담 기록 (환자 1:N) |
| `users` | 계정 유형 관리 |

---

## `patient`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | bigint PK | 자동 증가 (실제 DB는 bigint, schema.sql 예시는 uuid) |
| `name` | text NOT NULL | 환자 이름 |
| `chart_no` | text | 차트 번호 (병원 내부 ID) |
| `phone` | text | 연락처 |
| `resident_no` | text | 주민등록번호 (XXXXXX-XXXXXXX 형식, UI에서 마스킹) |
| `resident_no_hash` | text | SHA-256 해시 — unique index, 중복 환자 방지 |
| `created_at` | timestamptz | 등록 시각 |

**인덱스**
- `patient_resident_no_hash_uidx` — `resident_no_hash` 컬럼, WHERE NOT NULL

**주의사항**
- `resident_no`는 평문 저장이므로 RLS 및 Server Action에서 반드시 접근 제어
- `id` 타입: 코드에서 `BigInt(id)`로 변환 후 쿼리. schema.sql 예시(uuid)와 실제 운영 DB(bigint) 다를 수 있으므로 마이그레이션 시 확인 필요

---

## `consultation`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `patient_id` | uuid FK → patient.id | 연결 환자 (CASCADE DELETE) |
| `content` | text | 상담 내용 |
| `image_urls` | jsonb | 이미지 URL 배열 (`["url1", "url2"]`) |
| `prescriptions` | jsonb | 처방 메모 배열 |
| `station_name` | text | 작성한 체어 번호 |
| `created_at` | timestamptz | 기록 시각 |

**인덱스**
- `consultation_patient_id_idx` — patient_id 검색 최적화

---

## `users`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | Supabase Auth 연동 시 auth.users(id) FK 권장 |
| `user_type` | text NOT NULL DEFAULT 'individual' | 계정 유형 |
| `created_at` | timestamptz | 가입 시각 |

---

## RLS (Row Level Security)

현재 모든 테이블에 RLS 활성화 상태이나, 정책은 개발 편의상 전체 허용 (`using (true)`)으로 설정됨.

**운영 전 필수 수정**: Supabase Auth와 연동하여 `auth.uid()` 기반 정책으로 교체해야 함.

```sql
-- 운영 예시 (patient 테이블)
create policy "patient owner" on public.patient
  for all using (auth.uid() = owner_id);
```

---

## Storage

| 버킷 | 공개 여부 | 용도 |
|---|---|---|
| `consultation-images` | Public | 상담 이미지 업로드/조회 |

버킷명은 환경변수 `NEXT_PUBLIC_SUPABASE_CONSULTATION_BUCKET`으로 오버라이드 가능.

---

## 마이그레이션 규칙

1. 스키마 변경 시 `supabase/schema.sql`을 **반드시** 함께 수정
2. 운영 DB에 직접 DDL 실행 후 schema.sql 업데이트 누락 금지
3. 컬럼 추가는 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 패턴 사용
4. 컬럼 삭제 전 코드에서 해당 컬럼 참조 제거 먼저 진행
