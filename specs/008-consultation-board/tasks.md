---
description: "Task list — 상담보드 (Consultation Board)"
---

# Tasks: 상담보드 (Consultation Board) — record-first 통합 상담 기록

**Input**: Design documents from `specs/008-consultation-board/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 본 프로젝트는 별도 테스트 하네스 없음 → 테스트 태스크 생략. 검증은 `npm run build` 그린 + `quickstart.md` 수동 시나리오.

**Organization**: 유저스토리(P1→P2→P3)별 독립 슬라이스. MVP = US1.

## Path Conventions
Next.js 앱(repo 루트): `app/`, `components/`, `lib/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 빌드 베이스라인 확인 — `npm run build` 그린(placeholder env 허용) 상태에서 시작

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: US1·US3(보드)의 토대. 이 단계 전엔 보드 작업 불가.

- [x] T002 `components/chair/chair-provider.tsx`에 **`__draft__` 녹음 슬롯** 추가 — 체어 없이 `startRecording("__draft__")`/`stopRecording("__draft__")`/`resetChair("__draft__")` 동작(기존 per-chair 맵 키에 sentinel 허용), draft 상태·전사텍스트 getter 노출. 기존 per-chair 동작 회귀 없음.
- [x] T003 `components/chair/chair-provider.tsx`에 **보드 오픈 상태**(`openBoard`/`closeBoard`, draft 진입용) 추가 — 기존 `openOverlay`(per-chair)와 별개로 record-first 보드 진입점.

**Checkpoint**: 체어 없이 녹음 시작/중지 가능, 보드 마운트 토대 준비.

---

## Phase 3: User Story 1 - 일단 녹음부터 (record-first) (Priority: P1) 🎯 MVP

**Goal**: 체어·참여자 선택 없이 1탭 즉시 녹음 → 중지·전사 → 저장 시 체어 귀속.

**Independent Test**: 아무것도 안 고른 채 녹음→상담→중지→체어 선택→저장까지 완료, 기록 보존.

- [x] T004 [US1] `components/chair/consultation-board.tsx` 신규 — createPortal 보드: 상단 녹음바(idle [녹음 시작]/recording 타이머+[중지]/processing 스피너) + 본문 textarea(전사 채움·편집) + 체어 칩 한 줄 선택(미선택 허용) + [저장]/[버리기]. draft 세션 상태 구독.
- [x] T005 [US1] `app/(dashboard)/layout.tsx`에 `ConsultationBoard` 마운트(기존 `ChairOverlay` 옆) — provider 하위.
- [x] T006 [US1] `components/chair/consult-hero.tsx` 수정 — "바로 녹음"/"상담 기록 시작" 클릭 시 `startRecording("__draft__")` + `openBoard()`(클릭 제스처 안에서 getUserMedia). 기존 원탭(마지막 체어) 경로는 유지하되 보드로 합류.
- [x] T007 [US1] `components/chair/consultation-board.tsx` 중지 처리 — `stopRecording("__draft__")` blob → `transcribeChairAudio` → 본문 채움. 빈 녹음(<1KB)은 기존 진단 안내 재사용.
- [x] T008 [US1] `components/chair/consultation-board.tsx` 저장 처리 — 선택 체어로 `saveChairRecord({chairId, content, participants, prescriptions})`, 체어 미선택 시 빠른 선택 유도(차단 아님), 성공 시 draft reset + `refreshUnlinkedCount` + 성공 메시지(한국어).
- [x] T009 [US1] 보드 닫기/재진입 시 녹음 지속 확인(provider ref 재사용) + 미저장 draft 보존(FR-016) — `consultation-board.tsx` 닫기 동작이 draft를 reset하지 않도록.

**Checkpoint**: US1 단독으로 "급할 때 1탭 녹음 후 저장" 완성 = MVP. 배포 가능.

---

## Phase 4: User Story 2 - 참여자 부담 없이 붙이기 (Priority: P2)

**Goal**: '나' 자동 + 검색 + 최근순 + 역할 후순위로 26명 과부하 해소. 미지정 저장 허용.

**Independent Test**: 멤버 20+ 기관에서 참여자 1명을 검색/자동으로 3초 내 지정하거나 미지정 저장.

- [x] T010 [P] [US2] `app/actions/chairs.ts`에 **`getRecentParticipants(limit=8)`** 읽기 액션 — 최근 consultation `participants` jsonb distinct(name) 최근순. 실패 시 `[]`. 기관 격리.
- [x] T011 [P] [US2] 현재 사용자 '나' 참여자 전달 — `app/(dashboard)/layout.tsx`(또는 page)에서 `getMyAuthorInfo` 표시명으로 `me: Participant`를 구해 `ChairProvider`에 prop 전달, context로 노출.
- [x] T012 [US2] `components/chair/participant-picker.tsx` 신규 — props(members·recent·me·value·onChange). 렌더 순서: 선택됨→검색창→[나]→[최근]→[진료/현장 역할]→[기타 후순위]. `maskName` 적용, 검색은 후순위 포함 전체 도달, 미선택 허용.
- [x] T013 [US2] `consultation-board.tsx`에 `participant-picker` 통합(평면 목록 대체) + `getRecentParticipants` 호출. `consult-hero.tsx`의 참여자 칩도 동일 피커로 교체.

**Checkpoint**: US1 + US2 — 빠른 녹음 + 참여자 부담 해소.

---

## Phase 5: User Story 3 - 한 화면에서 상담 진행 (종합 보드) (Priority: P3)

**Goal**: 녹음 도는 동안 본문·그림·처방·체어를 한 보드에서 동시 편집 후 저장.

**Independent Test**: 녹음 중 본문 입력·그림 주석·처방 선택해도 녹음 끊김 0, 한 화면 저장.

- [x] T014 [US3] `consultation-board.tsx` 본문을 `textarea` → `RichTextEditor`(인라인 이미지 + `ImageAnnotator` 그림 주석)로 교체. 저장은 기존 `ensureHtml`/`sanitizeRichHtml` 경로와 호환.
- [x] T015 [US3] `consultation-board.tsx`에 `PrescriptionPicker` 추가 — 저장 시 prescriptions 포함.
- [x] T016 [US3] 녹음 중 편집 시 끊김 0 보장 — 입력/그림/처방 상호작용이 draft 녹음을 재시작·중단하지 않음 확인(상태 분리).
- [ ] T017 [P] [US3] (선택) 녹음 일시정지/재개 — `chair-provider` pause/resume + 보드 녹음바 버튼. 미지원 환경은 숨김.

**Checkpoint**: 전체 보드 캔버스 완성.

---

## Phase 6: Polish & Cross-Cutting

- [x] T018 [P] `project_status.md` 세션 항목 추가(상담보드, 단계별 상태).
- [x] T019 [P] `docs/architecture.md` 갱신 — 보드·draft 세션 데이터흐름, participant-picker, getRecentParticipants.
- [x] T020 `npm run build` 그린(placeholder env로 완주) 확인.
- [ ] T021 `quickstart.md` 시나리오 수동 검증(프로덕션) — 파일럿에서 SC-007 포함.

---

## Dependencies & Execution Order

- **Setup(P1)** → **Foundational(P2: T002·T003)** → US 단계.
- **US1(P1)**: T004→T005→T006→T007→T008→T009 (보드 기본 흐름, 순차).
- **US2(P2)**: T010·T011 병렬 가능 → T012 → T013. US1 보드에 얹힘(US1 후 권장).
- **US3(P3)**: T014→T015→T016, T017 선택. US1 보드 위.
- **Polish**: 마지막. T018·T019 병렬.

### Parallel Opportunities
- T010 [P] · T011 [P] (다른 파일).
- T018 [P] · T019 [P] (문서, 다른 파일).

---

## Implementation Strategy

### MVP First (US1)
1. Phase 1·2 완료(토대: draft 슬롯).
2. Phase 3(US1) 완료 → **STOP & VALIDATE**(quickstart P1) → 배포 가능.

### Incremental
US1(MVP) → US2(참여자) → US3(풀 캔버스). 각 단계 독립 배포·검증.

---

## Notes
- DB 변경 0(MVP) → 마이그레이션 불요. P3도 스키마 변경 없을 전망.
- 기존 per-chair 오버레이·실시간 알림 회귀 금지.
- 커밋은 태스크/논리 그룹 단위, 빌드 그린 유지.
