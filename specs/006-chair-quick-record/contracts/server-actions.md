# Server Action Contracts: Chair Quick Record

All actions live in `app/actions/chairs.ts` ("use server"). Every action follows the `{ ok, message }` response shape per Constitution III.

---

## `getChairs()`

**Purpose**: 현재 직원의 소속 기관 활성 체어 목록 조회  
**Called by**: `(dashboard)/layout.tsx` (서버 컴포넌트에서 초기 로드)

```typescript
export async function getChairs(): Promise<ChairRow[]>
```

- Reads `institution_id` from `get_my_institution_id()` (RLS helper)
- Returns chairs ordered by `display_order ASC`
- Returns empty array if no chairs configured

---

## `saveChairRecord(params)`

**Purpose**: 녹음 종료 후 임시 기록을 DB에 저장 (patient_id 없음)  
**Called by**: `ChairOverlay` (client component → Server Action)

```typescript
type SaveChairRecordParams = {
  chairId: string;
  content: string;      // sanitizeRichHtml() 적용 후 저장
};

type SaveChairRecordResult =
  | { ok: true; consultationId: string }
  | { ok: false; message: string };

export async function saveChairRecord(
  params: SaveChairRecordParams
): Promise<SaveChairRecordResult>
```

- Validates caller is institution member
- Inserts consultation row: `patient_id=NULL, chair_id, institution_id, content, status='draft'`
- Inserts `chair_audit_logs` row: `event_type='record_created'`
- Returns `consultationId` for overlay to track

---

## `updateChairRecordContent(params)`

**Purpose**: 오버레이 내 텍스트 수정 저장  
**Called by**: `ChairOverlay` (client component → Server Action)

```typescript
type UpdateChairRecordContentParams = {
  consultationId: string;
  content: string;
};

type UpdateChairRecordContentResult =
  | { ok: true }
  | { ok: false; message: string };

export async function updateChairRecordContent(
  params: UpdateChairRecordContentParams
): Promise<UpdateChairRecordContentResult>
```

- Validates: consultation belongs to caller's institution AND `patient_id IS NULL` (still unlinked)
- Updates `content` (sanitized) only
- Inserts `chair_audit_logs` row: `event_type='record_edited'`
- Calls `revalidatePath('/')` (dashboard home shows recent records)

---

## `linkChairRecordToPatient(params)`

**Purpose**: 임시 기록을 실제 환자에 연결하여 정식 상담 기록으로 전환  
**Called by**: `ChairOverlay` patient search step (client → Server Action)

```typescript
type LinkChairRecordParams = {
  consultationId: string;
  patientId: number;
};

type LinkChairRecordResult =
  | { ok: true }
  | { ok: false; message: string };

export async function linkChairRecordToPatient(
  params: LinkChairRecordParams
): Promise<LinkChairRecordResult>
```

- Validates: consultation is unlinked (`patient_id IS NULL`)
- Validates: patientId belongs to caller's institution
- Updates consultation: `patient_id=patientId, status='confirmed', linked_at=now(), linked_by=auth.uid()`
- Inserts `chair_audit_logs` row: `event_type='patient_linked', patient_id_before=NULL, patient_id_after=patientId`
- Calls `revalidatePath('/patients/[patientId]')` and `revalidatePath('/')`

---

## `deleteChairRecord(params)`

**Purpose**: 임시 기록 삭제  
**Called by**: `ChairOverlay` record list (client → Server Action)

```typescript
type DeleteChairRecordParams = {
  consultationId: string;
};

type DeleteChairRecordResult =
  | { ok: true }
  | { ok: false; message: string };

export async function deleteChairRecord(
  params: DeleteChairRecordParams
): Promise<DeleteChairRecordResult>
```

- Validates: consultation is unlinked (`patient_id IS NULL`) — cannot delete linked records this way
- Validates: belongs to caller's institution
- Inserts `chair_audit_logs` row: `event_type='record_deleted'` FIRST (before delete, to preserve reference)
- Deletes consultation row
- Calls `revalidatePath('/')`

---

## `getUnlinkedChairRecords(chairId)`

**Purpose**: 특정 체어의 미연결 임시 기록 목록 조회  
**Called by**: `ChairOverlay` (unlinked list view)

```typescript
export async function getUnlinkedChairRecords(
  chairId: string
): Promise<Array<{ id: string; content: string; created_at: string }>>
```

- Queries: `consultation WHERE chair_id = chairId AND patient_id IS NULL AND institution_id = get_my_institution_id()`
- Orders by `created_at DESC`
- Returns minimal fields (no full content for list view — truncated to 200 chars)

---

## `upsertChair(params)` *(admin only)*

**Purpose**: 체어 추가 또는 수정 (설정 페이지용)  
**Called by**: Chair settings in `(dashboard)/settings/page.tsx`

```typescript
type UpsertChairParams = {
  id?: string;          // undefined = insert new
  name: string;
  displayOrder: number;
  isActive: boolean;
};

type UpsertChairResult =
  | { ok: true; chairId: string }
  | { ok: false; message: string };

export async function upsertChair(
  params: UpsertChairParams
): Promise<UpsertChairResult>
```

- Validates caller is `admin` or `owner` role
- Upserts `chairs` row
- Calls `revalidatePath('/')`

---

## Client Context API (`components/chair/chair-provider.tsx`)

The `ChairContext` provides the following to all dashboard client components:

```typescript
type ChairContextValue = {
  chairs: ChairRow[];
  openChairId: string | null;
  openOverlay: (chairId: string) => void;
  closeOverlay: () => void;
  // Per-chair recording state
  getChairStatus: (chairId: string) => ChairStatus;
  startRecording: (chairId: string) => Promise<void>;
  stopRecording: (chairId: string) => void;
  // After transcription completes
  setTranscriptionResult: (chairId: string, text: string) => void;
  // Unlinked record count (drives header badge)
  unlinkedCounts: Record<string, number>;
  refreshUnlinkedCount: (chairId: string) => Promise<void>;
};

type ChairStatus = 'idle' | 'recording' | 'processing' | 'has_records';
```
