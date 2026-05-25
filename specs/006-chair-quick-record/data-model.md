# Data Model: Chair Quick Record

## New Tables

### `chairs`

기관 내 진료 공간 단위. 기관당 최대 10개.

| Column         | Type        | Constraints                          | Notes                  |
|----------------|-------------|--------------------------------------|------------------------|
| `id`           | uuid        | PK, default gen_random_uuid()        |                        |
| `institution_id` | uuid      | NOT NULL, FK → institutions(id)      | RLS 기준               |
| `name`         | text        | NOT NULL                             | "A", "B", "C" 등       |
| `display_order`| integer     | NOT NULL DEFAULT 0                   | 헤더 표시 순서         |
| `is_active`    | boolean     | NOT NULL DEFAULT true                | 비활성화 시 헤더 미표시 |
| `created_at`   | timestamptz | NOT NULL DEFAULT now()               |                        |

**Unique constraint**: `(institution_id, name)`  
**RLS**: institution_members만 READ; admin/owner만 INSERT/UPDATE/DELETE  
**Seed**: migration에서 기존 기관당 A/B/C 기본 체어 삽입

---

### `chair_audit_logs`

모든 체어 기록 이벤트의 불변 감사 로그. 삽입 전용.

| Column           | Type        | Constraints                        | Notes                              |
|------------------|-------------|------------------------------------|------------------------------------|
| `id`             | uuid        | PK, default gen_random_uuid()      |                                    |
| `institution_id` | uuid        | NOT NULL, FK → institutions(id)    | RLS 기준                           |
| `chair_id`       | uuid        | NULL, FK → chairs(id)              | 체어 삭제 후에도 로그 보존          |
| `consultation_id`| uuid        | NULL, FK → consultation(id)        | 기록 삭제 후에도 로그 보존          |
| `event_type`     | text        | NOT NULL CHECK IN (see below)      |                                    |
| `actor_user_id`  | uuid        | NOT NULL, FK → auth.users(id)      | 행위자                              |
| `patient_id_before` | bigint  | NULL                               | 연결 이벤트 전 patient_id          |
| `patient_id_after`  | bigint  | NULL                               | 연결 이벤트 후 patient_id          |
| `metadata`       | jsonb       | NOT NULL DEFAULT '{}'              | 이벤트별 추가 정보                  |
| `created_at`     | timestamptz | NOT NULL DEFAULT now()             | 클라이언트 값 무시, 서버 now() 사용 |

**event_type** CHECK values:
- `'record_created'` — 체어에 임시 기록 생성
- `'record_transcribed'` — AI 변환 완료
- `'record_edited'` — 텍스트 수정 저장
- `'patient_linked'` — 환자 연결 (`patient_id_before = NULL → patient_id_after = X`)
- `'record_deleted'` — 기록 삭제

**RLS**:
- `SELECT`: institution members  
- `INSERT`: institution members (actor_user_id = auth.uid() 강제)  
- `UPDATE/DELETE`: 없음 (불변)

---

## Modified Tables

### `consultation` (기존 테이블 변경)

| Column        | Change                              | Notes                                    |
|---------------|-------------------------------------|------------------------------------------|
| `patient_id`  | NOT NULL → **NULL 허용**            | 체어 임시 기록은 patient_id 없이 저장     |
| `chair_id`    | **신규 컬럼** uuid NULL, FK → chairs | 체어 기록임을 식별                        |
| `linked_at`   | **신규 컬럼** timestamptz NULL       | 환자 연결 시각                            |
| `linked_by`   | **신규 컬럼** uuid NULL, FK → auth.users | 환자 연결 행위자                      |

**기존 컬럼 유지**: `id`, `institution_id`, `content`, `image_urls`, `prescriptions`, `station_name`, `status`, `sms_sent_at`, `created_at`

**임시 기록 구분 조건**: `patient_id IS NULL AND chair_id IS NOT NULL`  
**정식 기록 조건**: `patient_id IS NOT NULL`

---

## Updated TypeScript Types (`lib/types/database.ts`)

```typescript
// 신규
export type ChairRow = {
  id: string;
  institution_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type ChairAuditLogRow = {
  id: string;
  institution_id: string;
  chair_id: string | null;
  consultation_id: string | null;
  event_type:
    | 'record_created'
    | 'record_transcribed'
    | 'record_edited'
    | 'patient_linked'
    | 'record_deleted';
  actor_user_id: string;
  patient_id_before: number | null;
  patient_id_after: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

// 수정 (기존 ConsultationRow)
export type ConsultationRow = {
  id: string;
  patient_id: number | null;       // was: string (NOT NULL) → nullable, changed to number (bigint)
  institution_id: string;
  content: string;
  image_urls: string[] | null;
  prescriptions: string[] | null;
  station_name: string | null;
  status: 'draft' | 'confirmed';
  sms_sent_at: string | null;
  created_at: string;
  // 신규 필드
  chair_id: string | null;
  linked_at: string | null;
  linked_by: string | null;
};
```

---

## State Transitions

### Consultation (체어 기록 생명주기)

```
[없음]
  │  직원이 녹음 시작 후 종료
  ▼
[임시 기록] — patient_id=NULL, chair_id=X, status='draft'
  │  "환자 연결" 액션
  ▼
[정식 기록] — patient_id=Y, chair_id=X, status='confirmed', linked_at=T, linked_by=U
```

```
[임시 기록]
  │  "삭제" 액션 (audit log 기록)
  ▼
[삭제됨] — DB row 삭제, chair_audit_logs에 record_deleted 이벤트 영구 보존
```

---

## Entity Relationships

```
institutions ─── chairs (1:N)
institutions ─── consultation (1:N)
chairs ─────────── consultation (1:N, nullable)
auth.users ──────── consultation.linked_by (N:1, nullable)
chairs ─────────── chair_audit_logs (1:N, nullable FK)
consultation ───── chair_audit_logs (1:N, nullable FK)
institutions ─── chair_audit_logs (1:N)
auth.users ──────── chair_audit_logs.actor_user_id (N:1)
```
