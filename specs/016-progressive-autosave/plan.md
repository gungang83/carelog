# Implementation Plan: 점진 청크 전사 + 상담 종료/자동저장

**Branch**: `016-progressive-autosave` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)

## Summary

- **점진 전사**: `chair-provider`의 청크 `onstop`이 구간 push 직후 `onSegmentReady(seg, index)` 콜백을 호출. 보드가 녹음 시작 시 핸들러를 등록해 **구간 완료 즉시 백그라운드 전사**(`liveTextsRef`/`liveTasksRef` 누적). 종료 시 `finalizeChunked`가 진행 중 작업을 대기 + 누락 구간 안전망 전사 후 요약. 기존 일괄 `transcribeSegments`는 **복구 경로 전용**으로 유지.
- **자동저장**: 녹음 바 "상담 종료"(개명) + "상담 종료 및 저장"(`handleStopAndSave` → `autoSaveRef=true` → handleStop). 전사 완료 콜백(`transcribeBlob`/`finishChunkTexts`)이 `doAutoSave`를 호출 → `saveChairRecord` + 음성 업로드 + 정리 + 보드 닫기. 보드는 레이아웃 상시 마운트라 닫아도 백그라운드 완료.
- **안전망/로그**: 실패 시 IndexedDB 임시본 유지(기존) + `reportAutoSaveFailure`(서버 액션, Vercel 로그, PII 미포함) + 사용자 안내.

## Technical Context

**Language/Version**: TypeScript strict · Next.js 16.2.2 · React 19
**Primary Dependencies**: 기존 MediaRecorder 청크 루프(spec 010)·전사 액션·`saveChairRecord`·음성 업로드(spec 009)·임시본(IndexedDB)·알림(spec 012). **신규 외부 의존성·DB 변경 0.**
**Testing**: `npm run build`(TS·compile) 그린 + 예미안 수동 검증(청크 점진·자동저장·실패 안전망).
**Constraints**: 비차단(전사·저장 실패가 상담 데이터·수동 흐름 불변)·환자 PII 미적재·기존 녹음/복구 회귀 0.

## Constitution Check

- [x] **I. Patient Privacy First** — `reportAutoSaveFailure`는 진단 메타만(PII 미포함). 전사·저장 경로 불변.
- [x] **II. Server-Side Data Authority** — 저장은 서버 `saveChairRecord`. 자동저장은 호출 시점만 바꿈.
- [x] **III. Clinical Reliability** — 비차단·임시본 보존·실패 로그. 점진 전사는 실패 격리(구간별)·요약 폴백 유지. **신규 스키마 없음**.
- [x] **IV. Simplicity Over Abstraction** — 전사 결과 처리(`finishChunkTexts`)를 라이브/복구 공용으로 단일화. 콜백 1개(`onSegmentReady`) 추가.
- [x] **V. Spec-Driven Development** — 본 spec/plan 존재.
- [x] **VI. Documentation as Living Artifact** — architecture.md·project_status.md 갱신(스키마 변경 없어 database.md 불변).

## Project Structure

```text
specs/016-progressive-autosave/  (spec·plan·tasks · checklists/)

components/chair/chair-provider.tsx     # [수정] MediaRefs.onSegmentReady + 청크 onstop 통지 + registerSegmentHandler
components/chair/consultation-board.tsx # [수정] 점진 전사(handleStart 등록·finalizeChunked·finishChunkTexts) + 자동저장(handleStopAndSave·doAutoSave) + 버튼/진행표시
components/rich-text-editor.tsx         # [수정] getHTML() 핸들(자동저장 동기 캡처)
app/actions/chairs.ts                   # [수정] reportAutoSaveFailure(서버 로그)
docs/architecture.md · project_status.md  # [수정]
```

**Structure Decision**: spec 010 청크 루프에 per-segment 콜백 1개를 더해 점진 전사를 끼우고, 전사 완료 지점에 자동저장 훅을 단다. DB·서버 스키마 무변경. 탭 생명주기 완전 분리(서버 잡)는 후속 spec.

## Complexity Tracking

| 추가 요소 | 왜 필요 | 더 단순한 대안 기각 이유 |
|---|---|---|
| onSegmentReady 콜백 | 녹음 중 구간을 즉시 전사(대기 단축) | 종료 후 일괄(기존)은 대기 그대로 |
| doAutoSave 분기 | 검토 없이 빠른 저장 경로 | 수동 저장만으론 "기다림" 해소 안 됨 |
| reportAutoSaveFailure | 자동저장 실패의 서버 로그(진단) | 콘솔만으론 운영 추적 어려움 |
