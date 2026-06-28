# Phase 1 Data Model: 긴 상담 청크 분할 전사

DB 스키마 변경은 **없다**(spec 009 `consultation.audio_path` 단일 경로 재사용). 아래는 런타임/클라이언트 데이터 구조와 기존 타입 확장이다.

## 런타임 엔티티

### AudioSegment (클라이언트, 메모리/IndexedDB)
한 녹음 세션을 시간순으로 나눈 구간.
- `index: number` — 0부터, 녹음 순서.
- `blob: Blob` — 독립 유효 webm(audio/webm;codecs=opus, 32kbps).
- (전사 단계 파생) `status: "ok" | "failed"` — 전사 결과.
- (전사 단계 파생) `text: string` — 구간 전사문(성공 시).

> 저장: `MediaRecorder` stop→restart 시 `segments[]`(ref)에 누적. 종료 직후 IndexedDB 영속화.

### ChunkTranscriptionResult (전사 산출, 기존 EngineRun에 매핑)
구간 전사·요약을 합친 결과. 기존 `EngineRun`(`lib/transcribe/engines.ts`) 형태로 반환해 UI 변경 최소화.
- `engine: "chunk"`
- `label: "긴 상담"`
- `transcription: string` — 성공 구간 전사문을 순서대로 이어붙인 전체 원문(실패 구간 자리표시 포함 가능).
- `summary: string` — 전체 원문 1회 요약(`SUMMARY_PROMPT` 재사용).
- `insertText: string` — 본문 삽입용(요약).
- (UI 파생) `failedSegments?: number[]` — 실패 구간 인덱스(표시/재시도용).

## 기존 타입 확장

### `lib/transcribe/engines.ts`
- `EngineId`: `"basic" | "quick" | "detailed" | "dental" | "multilingual"` → **`| "chunk"` 추가**.
- `LAB_ENGINE_OPTIONS`: `{ value: "chunk", label: "긴 상담", desc: "긴 상담을 5분 단위로 나눠 끊김 없이 전사(중간 실패에 강함)" }` 추가.
- `EngineRun`: 변경 없음(chunk도 동일 형태 사용). 필요 시 `failedSegments?: number[]` 옵셔널 추가.

### `lib/chair/draft-store.ts`
- `BoardDraft`에 **`audioSegments?: Blob[]`** 추가(기존 `audioBlob`는 유지 — 단일 경로 호환).
- `draftHasContent`: 기존 조건에 `audioSegments?.length` 도 복구 대상으로 포함.

### `lib/types/database.ts`
- **변경 없음.** `consultation.transcription_engine`(text)에 `"chunk"` 문자열이 들어갈 뿐 컬럼/타입 불변.

## 상태 흐름 (chunk 모드)

```
[녹음 시작] → recording
   │  5분마다 stop→restart → segments[] 누적
[종료] → processing
   │  segments 즉시 IndexedDB 저장(복구 안전망)
   │  구간별 transcribeSegment (동시성3, 실패1회 재시도) → status/text
   │  진행률 n/m 갱신
   │  성공 전사문 순서대로 join → summarizeChunkTranscript → summary
[완료] → has_records (본문에 summary 삽입, usedEngine="chunk")
   │  저장 시: saveChairRecord(transcription_engine="chunk")
   │           + 구간 concat 단일 blob을 uploadConsultationAudio(기존 경로)
```

## 불변식 / 검증 규칙
- 구간 1개라도 성공하면 전체 실패가 아니다(부분 보존).
- 모든 구간 실패 시에만 전체 실패 → 녹음물(segments)은 IndexedDB에 보존(복구 가능).
- 비-lab 워크스페이스는 chunk 경로에 진입할 수 없다(서버 액션이 lab 게이트로 거부).
- 분할 간격보다 짧은 녹음 → segments 길이 1 → 통짜와 동등 처리.
