# Research: Chair Quick Record

## 1. Global Overlay State — React Context vs Zustand

**Decision**: React Context + useReducer (no Zustand)

**Rationale**:
- Feature touches <10 chairs, ~10 staff users per clinic — no state scale problem
- Adding Zustand introduces a new runtime dependency for a use case that React Context handles cleanly
- `ChairProvider` is created once at `(dashboard)/layout.tsx` level and persists across App Router navigations (RSC re-renders don't remount client providers)
- The `MediaRecorder` ref lives in a `useRef` inside the provider — stays alive even when overlay closes

**Alternatives considered**:
- **Zustand**: Cleaner devtools, but adds `zustand` to dependencies. Overkill for 10 items.
- **URL state / searchParams**: Not suitable — recording state is transient and not shareable

---

## 2. Audio Storage Strategy

**Decision**: Process audio in-memory; do not store raw audio files in Supabase Storage

**Rationale**:
- Current `transcribeAndSummarize` sends audio blob directly to OpenAI Whisper and discards it
- Storing audio adds GDPR/personal-data complexity (recording a patient's voice = sensitive data)
- Chair quick record sessions are typically <5 minutes → fits comfortably in memory
- Only the resulting text summary is persisted to DB

**Alternatives considered**:
- **Store audio in Supabase Storage bucket**: Adds PII storage obligation; unnecessary for the transcription use case
- **Store audio locally (IndexedDB)**: Complex sync, not portable across devices/browsers

---

## 3. DB Schema — Separate Table vs Extending `consultation`

**Decision**: Extend the existing `consultation` table (make `patient_id` nullable, add `chair_id`, `linked_at`, `linked_by`)

**Rationale**:
- Avoids data migration friction when linking (no row copy needed — just update `patient_id`)
- Reuses existing RLS policies (institution-scoped), UI components, and Server Actions
- `status = 'draft'` + `patient_id IS NULL` + `chair_id IS NOT NULL` → clear semantics for "unlinked chair record"
- Constitution III: schema changes require migration file ✅

**Alternatives considered**:
- **Separate `chair_quick_records` table → copy to `consultation` on link**: Requires duplication logic, two tables to keep in sync, more complex RLS
- **Virtual linking via foreign key join table**: Unnecessary indirection

**New columns on `consultation`**:
```
patient_id     bigint     NULL  (was NOT NULL — make nullable)
chair_id       uuid       NULL  FK → chairs(id)
linked_at      timestamptz NULL  (set when patient linked)
linked_by      uuid       NULL  FK → auth.users(id) (who linked)
```

---

## 4. Overlay Rendering — createPortal vs CSS z-index

**Decision**: `createPortal(overlay, document.body)`

**Rationale**:
- The dashboard `<header>` has `backdrop-filter: blur(...)` with `supports-[backdrop-filter]`
- Backdrop-filter creates a new stacking context; a `z-index: 9999` child inside it cannot appear above elements outside the header
- Rendering the overlay as a portal to `document.body` completely escapes this constraint
- Same technique already used in `HamburgerDrawer` — consistent pattern

**Alternatives considered**:
- **Pure CSS z-index on overlay**: Breaks inside `backdrop-filter` stacking context
- **Remove `backdrop-filter` from header**: Changes visual design unacceptably

---

## 5. Vercel Serverless Timeout for Transcription

**Decision**: Set `export const maxDuration = 120` in the transcribe route/action

**Rationale**:
- Vercel Hobby/Pro plans support up to 60s/300s respectively
- Dental consultations are typically 2–10 minutes; Whisper processes audio at ~10–50× realtime
- A 5-minute recording = ~30s of Whisper processing + ~5s Claude summarisation = ~35s total
- 120s budget covers recordings up to ~12 minutes comfortably
- Current `transcribeAndSummarize` has no `maxDuration` set — defaults to 10s on Hobby tier, which is risky for longer recordings

**Alternatives considered**:
- **Stream transcription progressively**: Requires Whisper streaming API (not available in standard model)
- **Background job queue**: Out of scope; Vercel serverless can handle this use case

---

## 6. Chairs Seeding Strategy

**Decision**: Seed three default chairs (A, B, C) per existing institution in migration; allow admin to add/rename

**Rationale**:
- Immediately usable after migration — no manual setup required for the primary user (single clinic)
- Migration uses `INSERT ... ON CONFLICT DO NOTHING` to be idempotent
- Admin settings UI can add/rename chairs in a follow-up

**Alternatives considered**:
- **No seed, require manual chair creation**: Poor first-run UX; breaks the immediate-use requirement
- **Configurable from env var**: Unnecessary complexity for a dental clinic context

---

## 7. Audit Log — Immutability Strategy

**Decision**: Insert-only `chair_audit_logs` table; RLS grants INSERT only (no UPDATE/DELETE) to authenticated staff

**Rationale**:
- Medical audit trails must be tamper-evident
- PostgreSQL enforces no-UPDATE/no-DELETE via RLS
- `created_at` is set by `now()` with `DEFAULT` and never exposed to client inputs
- Audit log entries are created by Server Actions (server-controlled), not client code

**Alternatives considered**:
- **Trigger-based audit log**: More complex, harder to reason about; Server Action explicit logging is clearer
- **Append-only via application convention**: Trust-based; RLS enforcement is stronger
