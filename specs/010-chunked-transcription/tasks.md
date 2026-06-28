---
description: "Task list for 긴 상담 청크 분할 전사 모드 (010-chunked-transcription)"
---

# Tasks: 긴 상담 청크 분할 전사 모드 (Chunked Transcription)

**Input**: Design documents from `specs/010-chunked-transcription/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/chunk-transcription.md

**Tests**: 본 프로젝트는 별도 테스트 하네스가 없다(plan.md "Testing": build 그린 + 수동 검증). → **테스트 task 미생성.** 검증은 quickstart.md 시나리오로 수행.

**Organization**: User Story별 단계. 단, 모든 스토리가 동일 chunk 파이프라인을 공유하므로 Foundational(파이프라인 기반)이 끝나야 스토리 작업이 가능하다. 스토리는 우선순위 순(P1→P1→P2→P3)으로 진행.

**제약(전 단계 공통)**: 마이그레이션·신규 버킷·신규 라이브러리 **0**. 비-lab 회귀 **0**. 새 외부 인프라 **0**. 기존 단일 blob 경로(basic/quick/detailed/dental/multilingual/comparison) **불변**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·무의존 → 병렬 가능
- **[Story]**: US1~US4 매핑

---

## Phase 1: Setup (Shared)

**Purpose**: 모드 등록·상수 — 로직 없는 공유 기반.

- [ ] T001 [P] `lib/transcribe/engines.ts`: `EngineId`에 `"chunk"` 추가, `LAB_ENGINE_OPTIONS`에 `{ value:"chunk", label:"긴 상담", desc:"긴 상담을 5분 단위로 나눠 끊김 없이 전사(중간 실패에 강함)" }` 추가, `EngineRun`에 `failedSegments?: number[]` 옵셔널 추가
- [ ] T002 [P] 청크 상수 정의(`lib/transcribe/engines.ts` 또는 인접): `SEGMENT_MS = 5*60*1000`, `CHUNK_CONCURRENCY = 3`, `SEGMENT_RETRY = 1`

**Checkpoint**: 픽커에 "긴 상담"이 lab에서 렌더된다(engine-selector 자동). 아직 전사 로직 없음.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 분할 녹음·구간 전사·요약·복구 영속화의 기반. **완료 전 어떤 스토리도 동작 불가.**

- [ ] T003 `lib/chair/draft-store.ts`: `BoardDraft`에 `audioSegments?: Blob[]` 추가, `draftHasContent`가 `audioSegments?.length`도 복구 대상으로 포함(기존 `audioBlob` 유지)
- [ ] T004 `components/chair/chair-provider.tsx`: **분할 녹음** — chunk 모드 녹음 시 `SEGMENT_MS`마다 `MediaRecorder.stop()`→즉시 `start(250)`로 구간을 끊어 유효 webm blob을 `refs.segments[]`에 누적. `stopRecording`이 마지막 구간 flush 후 `segments` 배열을 반환/노출, `resetChair`가 `segments` 비움. 32kbps·wake lock 유지. **비-chunk 단일 blob 경로는 불변.**
- [ ] T005 `app/actions/transcribe.ts`: `transcribeSegment(formData)` 신규 Server Action — `getMyInstitutionLab()` 게이트(비-lab `{ok:false}`), 구간 1개 `transcribeKo` 전사, `{ ok:true, text, index? } | { ok:false, message, index? }` 반환(무음 구간은 `text:""`로 성공)
- [ ] T006 `app/actions/transcribe.ts`: `summarizeChunkTranscript(fullText)` 신규 Server Action — lab 게이트, `SUMMARY_PROMPT` 재사용 Claude 요약 1회, `{ ok:true, summary } | { ok:false, message }` 반환(빈 입력 거부)

**Checkpoint**: 분할 녹음·구간 전사·요약 단위가 준비됨. 오케스트레이션(스토리)에서 조립 가능.

---

## Phase 3: User Story 1 - 긴 상담도 끊김 없이 기록 (Priority: P1) 🎯 MVP

**Goal**: 30~40분 녹음을 chunk 모드로 끊김 없이 전사·요약해 본문에 채우고 저장.

**Independent Test**: lab에서 "긴 상담"으로 30분+ 녹음→종료→전 구간 전사문+전체 요약이 본문에 삽입·저장되는지(quickstart 시나리오 1).

- [ ] T007 [US1] `components/chair/consultation-board.tsx`: `handleStop` 분기 — `engine==="chunk"`면 chair-provider의 `segments` 기반 오케스트레이션 진입, 아니면 기존 단일 경로(`transcribeBlob`) 유지
- [ ] T008 [US1] `components/chair/consultation-board.tsx`: 구간별 `transcribeSegment` 호출을 동시성 `CHUNK_CONCURRENCY`로 실행(happy path) → 성공 `text`를 `index` 순서로 join
- [ ] T009 [US1] `components/chair/consultation-board.tsx`: join 전체 원문으로 `summarizeChunkTranscript` 호출 → `summary`, `EngineRun{ engine:"chunk", transcription:join, summary, insertText:summary }` 구성 → 에디터 삽입, `setUsedEngine("chunk")` (요약 실패 시 join 원문 폴백)
- [ ] T010 [US1] `components/chair/consultation-board.tsx`: 저장(`handleSave`) 시 `transcriptionEngine:"chunk"` 기록 + 보관용 `new Blob(segments)` concat 단일 blob을 `uploadConsultationAudio(id, fd)`로 업로드(A안, 기존 단일 경로)
- [ ] T011 [US1] `components/chair/consultation-board.tsx`: 짧은 녹음 edge — `segments.length <= 1`이면 단일 구간으로 통짜와 동등 처리(분할 경로가 1구간도 정상)

**Checkpoint**: chunk 모드로 긴 상담이 완료·저장된다(MVP). 실패 처리·진행률은 다음 단계.

---

## Phase 4: User Story 2 - 중간 실패해도 전손이 아니다 (Priority: P1)

**Goal**: 일부 구간 전사 실패가 전체를 날리지 않고, 성공 구간은 보존·표시되며, 크래시 후 복구·재전사된다.

**Independent Test**: 한 구간 전사를 강제 실패시켜도 성공 구간이 본문에 보존되고 실패가 표시/재시도되는지(quickstart 시나리오 2·5).

- [ ] T012 [US2] `components/chair/consultation-board.tsx`: 구간 전사를 `allSettled` 기반으로 변경 + 실패 구간 `SEGMENT_RETRY`회 재시도
- [ ] T013 [US2] `components/chair/consultation-board.tsx`: 부분 보존 — 실패 구간은 join에서 자리표시/생략, `failedSegments` 기록 후 본문/결과에 명시; **전 구간 실패 시에만** 전체 실패(`setMicError`)
- [ ] T014 [US2] `components/chair/consultation-board.tsx`: chunk 종료 직후(전사 시작 전) `saveDraft({ ..., audioSegments: segments })` 즉시 영속화(복구 안전망)
- [ ] T015 [US2] `components/chair/consultation-board.tsx`: `applyRecover` — 복구본에 `audioSegments`가 있고 본문이 비면 청크 재전사(US1 오케스트레이션 재사용)

**Checkpoint**: 부분 실패·크래시에도 데이터 손실 0(SC-002).

---

## Phase 5: User Story 3 - 통짜 vs 청크 A/B 비교 (Priority: P2)

**Goal**: lab 사용자가 같은 상담을 기본 vs 청크로 만들어 결과를 비교·평가.

**Independent Test**: 같은 음원을 기본/긴상담으로 각각 전사 → 결과 식별(사용 엔진 기록)·비교 가능(quickstart 시나리오 3).

- [ ] T016 [US3] 검증·보강 — 픽커 "긴 상담" lab 노출(자동) + `transcription_engine="chunk"`로 결과 식별 확인. 필요 시 본문 머리말/배지에 사용 모드 표기로 비교 가독성 보강(`components/chair/consultation-board.tsx`)

**Checkpoint**: 두 모드 결과를 사람이 나란히 비교 가능(C안 검증 기반).

---

## Phase 6: User Story 4 - 긴 전사 중 진행률 (Priority: P3)

**Goal**: "n/m 구간 전사 중" 표시로 깜깜이 대기 제거.

**Independent Test**: 여러 구간 전사 중 진행률이 갱신 표시되는지(quickstart 시나리오 1 관찰).

- [ ] T017 [US4] `components/chair/consultation-board.tsx`: chunk 전사 진행 상태(`done/total`) state 추가, 각 구간 호출 완료마다 갱신
- [ ] T018 [US4] `components/chair/consultation-board.tsx`: processing UI에 "n/m 구간 전사 중" 표시(기존 "음성 인식 중…" 영역 확장)

**Checkpoint**: 모든 스토리 독립 동작.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T019 [P] `docs/architecture.md`: 분할 녹음 + 구간별 전사(서버액션) + 전체 통짜 요약 데이터 흐름 추가
- [ ] T020 [P] `project_status.md`: 세션 기록(완료 기능·검증·보류한 후속)
- [ ] T021 `npm run build` 그린 확인(TypeScript·compile; /admin prerender는 env 부재로 제외)
- [ ] T022 quickstart.md 시나리오 1~6 예미안(lab) 수동 검증
- [ ] T023 비-lab 회귀 0 확인(SC-006) — 비-lab 워크스페이스 전사 동작·결과가 도입 전과 동일

---

## Dependencies & Execution Order

- **Setup(T001-T002)** → **Foundational(T003-T006)** → 스토리.
- **US1(T007-T011)**: Foundational 후. MVP.
- **US2(T012-T015)**: US1 오케스트레이션 위에 실패/복구 추가(같은 파일 → US1 후 순차).
- **US3(T016)**: Foundational의 픽커/엔진 식별로 대부분 충족 → 경량 검증·보강.
- **US4(T017-T018)**: US1 오케스트레이션 위 진행률(같은 파일 → US1 후).
- **Polish(T019-T023)**: 스토리 완료 후.

### Within `consultation-board.tsx`
T007~T018은 동일 파일을 순차 편집(파일 충돌 방지). 우선순위 순서대로 진행.

### Parallel Opportunities
- T001·T002 [P] (engines.ts 같은 파일이면 순차; 분리 시 병렬).
- T005·T006 동일 파일(transcribe.ts) → 순차.
- Polish T019·T020 [P] (다른 파일).

---

## Implementation Strategy

### MVP (US1까지)
1. Setup → 2. Foundational → 3. US1 → **검증(시나리오 1·4)** → 배포 가능(lab 전용이라 안전).

### Incremental
US1(긴 상담 완료) → US2(실패 격리/복구) → US3(비교) → US4(진행률). 각 단계 quickstart로 검증 후 다온 마무리(dev→main).

## Notes
- 테스트 task 없음(프로젝트 정책) — quickstart 수동 검증으로 대체.
- chunk만 신규 경로; 기존 모드·단일 blob·저장·보관 스키마 불변.
- 각 task 또는 논리 묶음 후 커밋(빌드 그린 유지).
