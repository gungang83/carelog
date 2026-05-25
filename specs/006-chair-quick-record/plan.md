# Implementation Plan: Chair Quick Record

**Branch**: `main` | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/006-chair-quick-record/spec.md`

## Summary

치과 직원이 환자를 선택하기 전에 즉시 녹음을 시작할 수 있는 글로벌 오버레이 기능. 헤더의 체어 버튼(A/B/C)을 탭하면 현재 화면 위에 오버레이가 열리며, 녹음 → AI 변환 → 임시 저장 → 환자 연결 흐름을 제공한다. 기존 `consultation` 테이블을 확장(patient_id nullable)하고, 새 `chairs` + `chair_audit_logs` 테이블을 추가한다. 클라이언트 상태는 `ChairProvider` (React Context) 가 관리하며 MediaRecorder ref를 보존한다.

## Technical Context

**Language/Version**: TypeScript 5 (strict) / Next.js 16.2.2 App Router  
**Primary Dependencies**: Supabase, Tailwind CSS v4, OpenAI Whisper (existing `transcribeAndSummarize`), Anthropic Claude (existing summarisation)  
**Storage**: PostgreSQL via Supabase — 신규 `chairs`, `chair_audit_logs` 테이블; `consultation` 확장  
**Testing**: Manual browser testing (PWA + desktop); Vercel preview deployment  
**Target Platform**: Mobile PWA + Desktop Chrome/Safari  
**Project Type**: Web application — Next.js App Router (RSC + Client Components mixed)  
**Performance Goals**: Overlay 열림 즉각적 (<100ms perceived); AI 변환 ≤2분 (SC-003)  
**Constraints**: Vercel serverless; no new npm dependencies; `transcribeAndSummarize` maxDuration = 120s; createPortal to escape backdrop-filter stacking context  
**Scale/Scope**: 단일 클리닉 기준 ~3–10 체어, ~10 staff users

## Constitution Check

- [X] **I. Patient Privacy First** — 체어 임시 기록은 `patient_id = NULL` → PII 없음. `resident_no`는 audit log에 포함 안 됨. 환자 연결 전까지 환자 개인정보 노출 없음. ✅
- [X] **II. Server-Side Data Authority** — 모든 DB 쓰기는 `app/actions/chairs.ts` Server Actions 경유. Client component는 표시 전용. RLS 유지. ✅
- [X] **III. Clinical Reliability** — 모든 Server Action: `{ ok, message }` 반환. Patch 시 명시적 필드 나열. `revalidatePath` 호출. 마이그레이션 파일 포함. ✅
- [X] **IV. Simplicity Over Abstraction** — `ChairProvider`: layout + overlay + header 3개 call site 존재 → 정당화됨. Zustand 불필요. 기존 `VoiceRecorder`, `transcribeAndSummarize` 재활용. ✅
- [X] **V. Spec-Driven Development** — `specs/006-chair-quick-record/spec.md` 존재 및 검증 완료. ✅
- [X] **VI. Documentation as Living Artifact** — 마무리 시 `docs/architecture.md`, `docs/database.md`, `supabase/schema.sql`, `project_status.md` 업데이트 필수. ✅

## Project Structure

### Documentation (this feature)

```text
specs/006-chair-quick-record/
├── plan.md              ← this file
├── research.md          ✅ complete
├── data-model.md        ✅ complete
├── quickstart.md        ✅ complete
├── contracts/
│   └── server-actions.md ✅ complete
└── tasks.md             (created by /speckit-tasks)
```

### Source Code Changes

```text
app/
  actions/
    chairs.ts                          NEW — Server Actions
  (dashboard)/
    layout.tsx                         MODIFIED — wrap with ChairProvider, pass chairs
    settings/
      page.tsx                         MODIFIED — add chair management section

components/
  chair/
    chair-provider.tsx                 NEW — ChairContext + useReducer + MediaRecorder refs
    chair-buttons.tsx                  NEW — header chair status buttons (client)
    chair-overlay.tsx                  NEW — createPortal overlay (client)
    chair-record-list.tsx              NEW — unlinked records list view (client)
    chair-patient-search.tsx           NEW — patient search within overlay (client)

lib/
  types/
    database.ts                        MODIFIED — add ChairRow, ChairAuditLogRow; update ConsultationRow

supabase/
  migrations/
    20260526000001_chair_quick_record.sql  NEW
  schema.sql                           MODIFIED (reference sync)

docs/
  architecture.md                      MODIFIED at wrap-up
  database.md                          MODIFIED at wrap-up

project_status.md                      MODIFIED at wrap-up
```

### Header Integration

`components/layout/header.tsx` (server component) — add `<ChairButtons />` slot:

```text
Header (server)
  └── ChairButtons (client) ← reads ChairContext
ChairOverlay (client, createPortal to body) ← reads ChairContext
ChairProvider (client) ← wraps (dashboard)/layout.tsx subtree
```

`(dashboard)/layout.tsx` fetches `chairs` server-side and passes as initial prop to `ChairProvider`. This avoids a client-side loading flash for the chair buttons.

### Overlay State Machine (per chair)

```
idle
  → [tap button] → overlay_open (idle view)
  → [start recording] → recording
  → [close overlay] → idle (recording continues in background)

recording
  → [tap button] → overlay_open (recording view, timer resumes)
  → [stop] → processing
  → [close overlay] → recording_background

processing
  → [success] → result_view
  → [error] → error_view

result_view
  → [save] → has_records (overlay closes)
  → [discard] → idle

has_records
  → [tap button] → overlay_open (record list)
  → [link patient] → patient_search
  → [delete all linked] → idle
```

## Complexity Tracking

No constitution violations.

| Component | Justification |
|-----------|---------------|
| `ChairProvider` (new context) | Used in 3 call sites: `(dashboard)/layout.tsx`, `header.tsx` (via ChairButtons), `ChairOverlay`. Meets the ≥2 call site rule. |
| `createPortal` for overlay | Required to escape `backdrop-filter` stacking context in header. Direct CSS z-index approach fails — see research.md §4. |
