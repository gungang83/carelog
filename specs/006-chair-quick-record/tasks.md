# Tasks: Chair Quick Record

**Input**: Design documents from `specs/006-chair-quick-record/`  
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Organization**: Tasks grouped by user story for independent implementation and testing.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: DB migration, TypeScript types, Server Action scaffolding

- [X] T001 Write `supabase/migrations/20260526000001_chair_quick_record.sql` — CREATE `chairs` table (id, institution_id, name, display_order, is_active), CREATE `chair_audit_logs` table (id, institution_id, chair_id nullable, consultation_id nullable, event_type CHECK, actor_user_id, patient_id_before, patient_id_after, metadata jsonb, created_at), ALTER `consultation` to DROP NOT NULL on `patient_id` and ADD COLUMNS `chair_id uuid`, `linked_at timestamptz`, `linked_by uuid`. Include RLS: chairs (staff READ, admin/owner write), chair_audit_logs (staff INSERT only, no UPDATE/DELETE). Seed default chairs A/B/C per existing institution using INSERT … ON CONFLICT DO NOTHING.
- [X] T002 [P] Update `lib/types/database.ts` — add `ChairRow` type (id, institution_id, name, display_order, is_active, created_at), add `ChairAuditLogRow` type (id, institution_id, chair_id, consultation_id, event_type union, actor_user_id, patient_id_before, patient_id_after, metadata, created_at), update `ConsultationRow` to make `patient_id: number | null` (was `string`), add `chair_id: string | null`, `linked_at: string | null`, `linked_by: string | null`
- [X] T003 [P] Create `app/actions/chairs.ts` with `"use server"` directive, all necessary imports (`createServerSupabaseClient`, `createAdminSupabaseClient`, `getMyInstitutionId`, `revalidatePath`, `sanitizeRichHtml`, types from `lib/types/database.ts`), and stub function exports matching contracts in `specs/006-chair-quick-record/contracts/server-actions.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Global state provider and header integration shell — all user story UI depends on this

**⚠️ CRITICAL**: US1 through US4 UI cannot function until ChairProvider and layout changes are in place

- [X] T004 Create `components/chair/chair-provider.tsx` — `"use client"` component exporting `ChairProvider` and `useChairContext` hook. State shape: `{ chairs: ChairRow[], openChairId: string | null, recording: Record<string, { status: 'idle'|'recording'|'processing'|'has_records', mediaRecorderRef: React.MutableRefObject<MediaRecorder|null>, chunksRef: React.MutableRefObject<Blob[]>, transcribedText?: string, savedConsultationId?: string }>, unlinkedCounts: Record<string, number> }`. Actions: `openOverlay(chairId)`, `closeOverlay()`, `getChairStatus(chairId): ChairStatus`, `startRecording(chairId)`, `stopRecording(chairId)`, `setTranscriptionResult(chairId, text)`, `setSavedConsultationId(chairId, id)`, `refreshUnlinkedCount(chairId)`. Use `useReducer` for state transitions. `startRecording` calls `navigator.mediaDevices.getUserMedia` and wires `MediaRecorder` into the ref stored in state. `refreshUnlinkedCount` will be wired to the `getUnlinkedChairRecords` server action in Phase 5.
- [X] T005 Modify `app/(dashboard)/layout.tsx` — fetch initial chairs server-side with `getChairs()` from `app/actions/chairs.ts`, import `ChairProvider` from `components/chair/chair-provider.tsx`, wrap the layout's returned JSX with `<ChairProvider initialChairs={chairs}>`. Keep existing `SessionRefresher`, `BadgeManager`, `Header`, `Footer` structure intact.
- [X] T006 Modify `components/layout/header.tsx` — import `ChairButtons` from `components/chair/chair-buttons.tsx` (will be created in T009), render `<ChairButtons />` inside the `ml-auto` div between `<RefreshButton />` and `<ProfileDropdown />`. TypeScript: `ChairButtons` will be a client component; no props needed (reads ChairContext internally).

**Checkpoint**: Layout compiles with ChairProvider wrapping. Header has a placeholder slot for chair buttons.

---

## Phase 3: User Story 1 — 즉시 녹음 시작 (Priority: P1) 🎯 MVP

**Goal**: Staff can tap chair button, start recording immediately in overlay without leaving current screen. Recording survives overlay close.

**Independent Test**: Tap chair A → overlay opens → start recording → close overlay (recording indicator stays on A button) → tap A again → overlay reopens in recording state → stop → temp record saved to DB with `patient_id=NULL, chair_id=<A uuid>`.

- [X] T007 [US1] Implement `getChairs()` in `app/actions/chairs.ts` — query `chairs WHERE institution_id = get_my_institution_id() AND is_active = true ORDER BY display_order ASC`, return `ChairRow[]`. Called by layout.tsx on server side (initial load).
- [X] T008 [US1] Implement `saveChairRecord(params: { chairId: string, content: string })` in `app/actions/chairs.ts` — validate caller is institution member via `getMyInstitutionId()`, validate `chairId` belongs to institution, call `sanitizeRichHtml(content)`, INSERT consultation row `{ institution_id, patient_id: null, chair_id, content, status: 'draft' }`, INSERT chair_audit_logs row `{ event_type: 'record_created', actor_user_id: auth.uid(), chair_id, consultation_id }`, call `revalidatePath('/')`, return `{ ok: true, consultationId }` or `{ ok: false, message }`.
- [X] T009 [P] [US1] Create `components/chair/chair-buttons.tsx` — `"use client"` component. Reads `chairs` and `getChairStatus(chairId)` from `useChairContext()`. Renders one button per chair. Button appearance by status: `idle` → grey circle outline with chair name; `recording` → red pulsing dot with chair name; `processing` → spinning indicator; `has_records` → amber warning dot with count badge. On click: calls `openOverlay(chairId)`. Tailwind styles consistent with existing header aesthetic (rounded-xl, border, text-sm).
- [X] T010 [US1] Create `components/chair/chair-overlay.tsx` — `"use client"` component. Uses `createPortal(content, document.body)` to escape header stacking context. Reads `openChairId`, `closeOverlay`, `getChairStatus`, `startRecording`, `stopRecording` from `useChairContext()`. Renders: backdrop (fixed inset-0 bg-black/40 z-50), centered dialog panel (bg-white rounded-2xl shadow-xl, max-w-lg w-full). States rendered in this phase: `idle` (shows "녹음 시작" button), `recording` (shows red pulsing indicator + elapsed timer + "중지 및 변환" button), close button always visible. On close during recording: shows "녹음이 계속 진행됩니다" toast and calls `closeOverlay()`. `stopRecording()` from context stops the MediaRecorder and sets status to `processing`.
- [X] T011 [US1] Wire `ChairOverlay` into `app/(dashboard)/layout.tsx` — import `ChairOverlay` from `components/chair/chair-overlay.tsx`, render `<ChairOverlay />` as a sibling to `<Header />` inside the `ChairProvider` (placement: after `<BadgeManager />`). Verify the overlay renders above all content by testing in browser.

**Checkpoint**: US1 fully functional. Tap chair → overlay → record → close → recording continues → reopen → stop → DB row with `patient_id=NULL`. Verify `chair_audit_logs` has `record_created` event.

---

## Phase 4: User Story 2 — AI 변환 및 기록 편집 (Priority: P2)

**Goal**: After recording stops, overlay shows transcription progress, then editable text. Staff can edit and save.

**Independent Test**: Start and stop recording on Chair B → overlay shows "음성 인식 중…" spinner → text appears → edit text → tap "임시 저장" → DB consultation content matches edited text, `chair_audit_logs` has `record_edited` event.

- [X] T012 [US2] Set `export const maxDuration = 120` at the top of `app/actions/transcribe.ts` (after `"use server"`) — prevents Vercel 10s default timeout from killing long recordings. Verify no TypeScript errors.
- [X] T013 [US2] Implement `updateChairRecordContent(params: { consultationId: string, content: string })` in `app/actions/chairs.ts` — validate consultation belongs to caller's institution AND `patient_id IS NULL` (still unlinked), call `sanitizeRichHtml(content)`, UPDATE `consultation SET content = sanitized` WHERE id matches, INSERT chair_audit_logs `{ event_type: 'record_edited', actor_user_id, chair_id, consultation_id }`, call `revalidatePath('/')`, return `{ ok: true }` or `{ ok: false, message }`.
- [X] T014 [US2] Extend `components/chair/chair-overlay.tsx` with `processing` and `result_view` states — when `stopRecording()` is called, the component invokes `transcribeAndSummarize(formData)` (imported from `app/actions/transcribe.ts`) using the chunks from context's `chunksRef`. Show spinner while processing. On success: call `setTranscriptionResult(chairId, summary)` and render editable `<textarea>` with the summary text. Render "임시 저장" button that calls `saveChairRecord({ chairId, content: editedText })` then `setSavedConsultationId(chairId, consultationId)` and transitions to `has_records` status. If already saved (editing existing record), call `updateChairRecordContent` instead. On transcription failure: show error message and fallback plain text `<textarea>` for manual entry. "버리기" button resets chair to `idle`.

**Checkpoint**: US2 fully functional. Recording stops → transcription runs → text editable → saved to DB. Verify `consultation.content` matches edited text and `chair_audit_logs` has both `record_created` and `record_edited` events.

---

## Phase 5: User Story 3 — 임시 기록에 환자 연결 (Priority: P3)

**Goal**: Staff can see unlinked records per chair and link them to real patients. Linked records become formal consultation records.

**Independent Test**: Chair A has one unlinked record → tap A → see record list → tap "환자 연결" → search patient → confirm → DB: `patient_id` set, `linked_at` set, `linked_by` set, `status='confirmed'`. Chair button badge disappears.

- [X] T015 [US3] Implement `getUnlinkedChairRecords(chairId: string)` in `app/actions/chairs.ts` — query `consultation WHERE chair_id = chairId AND patient_id IS NULL AND institution_id = get_my_institution_id() ORDER BY created_at DESC`, return array of `{ id, content (truncated to 200 chars), created_at }`.
- [X] T016 [US3] Implement `linkChairRecordToPatient(params: { consultationId: string, patientId: number })` in `app/actions/chairs.ts` — validate consultation is unlinked (`patient_id IS NULL`) and belongs to institution, validate `patientId` belongs to same institution (query `patient WHERE id = patientId AND institution_id = institutionId`), UPDATE consultation `{ patient_id: patientId, status: 'confirmed', linked_at: now(), linked_by: auth.uid() }`, INSERT chair_audit_logs `{ event_type: 'patient_linked', patient_id_before: null, patient_id_after: patientId, actor_user_id, chair_id, consultation_id }`, call `revalidatePath('/patients/[patientId]')` and `revalidatePath('/')`, return `{ ok: true }` or `{ ok: false, message }`.
- [X] T017 [US3] Implement `deleteChairRecord(params: { consultationId: string })` in `app/actions/chairs.ts` — validate consultation is unlinked and belongs to institution, INSERT chair_audit_logs `{ event_type: 'record_deleted', actor_user_id, chair_id, consultation_id }` FIRST (before delete to preserve reference), DELETE from consultation WHERE id matches, call `revalidatePath('/')`, return `{ ok: true }` or `{ ok: false, message }`.
- [X] T018 [P] [US3] Create `components/chair/chair-record-list.tsx` — `"use client"` component. Props: `{ chairId: string, onClose: () => void }`. On mount, calls `getUnlinkedChairRecords(chairId)`. Renders list of records: each shows truncated content, formatted `created_at`, "환자 연결" button, "삭제" button (with confirmation). "환자 연결" sets local state to show patient search. "삭제" calls `deleteChairRecord` then refreshes list. Empty state: "미연결 기록이 없습니다." with close button.
- [X] T019 [P] [US3] Create `components/chair/chair-patient-search.tsx` — `"use client"` component. Props: `{ consultationId: string, chairId: string, onLinked: () => void, onCancel: () => void }`. Renders text input for patient name/chart number search. Calls `searchPatients(query)` from `app/actions/patients.ts` (existing action — verify it exists and add `export async function searchPatients` if not). Shows patient results list. On patient selection: calls `linkChairRecordToPatient({ consultationId, patientId })` → on success calls `onLinked()`.
- [X] T020 [US3] Extend `components/chair/chair-overlay.tsx` with `has_records` state — when `getChairStatus(chairId) === 'has_records'`, render `<ChairRecordList chairId={openChairId} onClose={closeOverlay} />` in the overlay panel. Import `ChairRecordList` from `components/chair/chair-record-list.tsx`.
- [X] T021 [US3] Implement `refreshUnlinkedCount(chairId: string)` in `components/chair/chair-provider.tsx` — calls `getUnlinkedChairRecords(chairId)` and updates `unlinkedCounts[chairId]` in context state. Call this: (a) after `saveChairRecord` succeeds in overlay, (b) after `linkChairRecordToPatient` succeeds, (c) after `deleteChairRecord` succeeds. Update `ChairButtons` to read `unlinkedCounts` from context for badge display.

**Checkpoint**: US3 fully functional. Unlinked record → patient search → link → DB shows `patient_id`, `linked_at`, `linked_by`. Chair button badge clears. Audit log shows `patient_linked` event.

---

## Phase 6: User Story 4 — 감사 추적 및 체어 관리 (Priority: P4)

**Goal**: Audit logs are verified end-to-end. Admin can configure chairs from settings.

**Independent Test**: After completing US1–US3 scenarios, query `chair_audit_logs` and confirm each action produced a log row. Admin adds a new chair "D" from settings → header shows 4 chairs.

- [X] T022 [P] [US4] Implement `upsertChair(params: { id?: string, name: string, displayOrder: number, isActive: boolean })` in `app/actions/chairs.ts` — validate caller is `admin` or `owner` role (query `institution_members WHERE user_id = auth.uid() AND role IN ('admin','owner')`), UPSERT `chairs` row, call `revalidatePath('/')`, return `{ ok: true, chairId }` or `{ ok: false, message }`.
- [X] T023 [US4] Add chair management UI section to `app/(dashboard)/settings/page.tsx` — below existing staff settings, add "체어 관리" section. Fetch chairs with `getChairs()`. Render list with name, active toggle. Add "새 체어 추가" button that opens an inline form (name input, display order). On submit: calls `upsertChair`. Use `useTransition` for optimistic loading. Only show section to `admin` or `owner` roles (read role from existing institution data already available in settings page).

**Checkpoint**: US4 complete. Admin can add/disable chairs. All prior US1–US3 actions produce audit log entries visible via direct DB query.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation sync, build verification, edge case hardening

- [X] T024 [P] Update `supabase/schema.sql` — append new `chairs` table DDL, `chair_audit_logs` table DDL, and the three `ALTER TABLE consultation` statements (DROP NOT NULL patient_id, ADD chair_id, ADD linked_at, ADD linked_by). Update the "마지막 동기화" date comment.
- [X] T025 [P] Update `docs/database.md` — document `chairs` table (all columns, RLS), `chair_audit_logs` table (all columns, RLS, immutability), and the three new columns on `consultation`. Note the patient_id nullable change and migration file name.
- [X] T026 [P] Update `docs/architecture.md` — document the new component tree: `ChairProvider` wrapper in dashboard layout, `ChairButtons` in header, `ChairOverlay` with `createPortal`, overlay sub-components `ChairRecordList` and `ChairPatientSearch`. Note the RSC→Client boundary: layout (server) passes `initialChairs` to `ChairProvider` (client). Add `app/actions/chairs.ts` to the Server Actions section.
- [X] T027 Update `project_status.md` — mark Chair Quick Record feature complete, note the DB migration required, list known limitations (audio lost on browser tab close, transcription max ~12 min recordings).
- [X] T028 Run `npm run build` from project root and fix any TypeScript errors — common issues to watch: `ConsultationRow.patient_id` type change from `string` to `number | null` may break existing components that pass `patient_id` to patient lookup. Audit all usages of `ConsultationRow` in `components/consultation-history.tsx`, `app/(dashboard)/view/[consultationId]/page.tsx`, `app/(dashboard)/patients/[patientId]/page.tsx`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately. T002 and T003 can run in parallel with T001.
- **Phase 2 (Foundational)**: Depends on T001 (types needed) and T002 (ChairRow type needed for ChairProvider). BLOCKS all user story phases.
- **Phase 3 (US1)**: Depends on Phase 2 completion. T007, T008, T009 can run in parallel; T010 depends on T009 (imports ChairContext); T011 depends on T010.
- **Phase 4 (US2)**: Depends on Phase 3 completion (overlay exists, saveChairRecord exists).
- **Phase 5 (US3)**: Depends on Phase 4 completion (saved consultationId available in overlay state). T015–T017 (server actions) and T018–T019 (UI components) can run in parallel within the phase.
- **Phase 6 (US4)**: T022 independent of US1–US3 (different action). T023 depends on T022.
- **Phase 7 (Polish)**: T024–T027 can run in parallel. T028 must run last.

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational — MVP deliverable
- **US2 (P2)**: Depends on US1 (overlay structure and saveChairRecord must exist)
- **US3 (P3)**: Depends on US2 (savedConsultationId state in overlay needed for linking flow)
- **US4 (P4)**: Independent of US1–US3 (chair management is orthogonal); audit logging embedded in each prior action

---

## Parallel Example: Phase 3 (US1)

```
Parallel batch 1 (different files, no deps):
  Task T007: getChairs() server action
  Task T008: saveChairRecord() server action
  Task T009: ChairButtons component

Sequential:
  Task T010: ChairOverlay (imports context from T004, recording from T009 shape)
  Task T011: Wire overlay into layout (depends on T010)
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1 (T001, T002, T003)
2. Complete Phase 2 (T004, T005, T006)
3. Complete Phase 3 (T007–T011)
4. **STOP and VALIDATE**: Tap chair → record → overlay close → recording continues → stop → DB row with `patient_id=NULL`
5. Deploy to Vercel preview for stakeholder demo

### Incremental Delivery

1. Phase 1+2 → Foundation ready
2. Phase 3 → Instant recording works (MVP)
3. Phase 4 → AI transcription + edit works
4. Phase 5 → Patient linking works (full clinical flow)
5. Phase 6 → Admin chair config + audit verification
6. Phase 7 → Polish, build clean, docs updated

---

## Notes

- `[P]` tasks touch different files — safe to parallelize
- `[Story]` label maps to user story for traceability
- `patient_id` type in `ConsultationRow` changes from `string` to `number | null` — audit all existing usages before T028
- Audit log entries are created by Server Actions, not client code — never expose `chair_audit_logs` insert to client directly
- Verify `transcribeAndSummarize` Server Action still works after adding `maxDuration` export (T012)
- `createPortal` requires `typeof window !== 'undefined'` guard or `useEffect` mount check to avoid SSR errors
