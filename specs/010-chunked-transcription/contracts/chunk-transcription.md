# Contract: 청크 전사 Server Actions

신규 Server Action 2개. 둘 다 `getMyInstitutionLab()` 서버 게이트로 **lab 워크스페이스만** 허용(비-lab 거부 — 헌법 II 서버 권위). 결과는 `{ ok, ... } | { ok:false, message }`(헌법 III).

## 1) `transcribeSegment(formData: FormData): Promise<SegmentResult>`

구간 **1개**를 Whisper로 전사(요약 없음). 클라이언트가 구간마다 호출(동시성 제한·재시도는 클라이언트 오케스트레이션).

- **위치**: `app/actions/transcribe.ts` (또는 `chairs.ts`에서 lab 게이트 후 위임)
- **입력**: `formData.audio: File` — 단일 구간 webm. `formData.index?: string` — (선택) 구간 인덱스(로그/표시용, PII 아님).
- **출력**:
  ```ts
  type SegmentResult =
    | { ok: true; text: string; index?: number }
    | { ok: false; message: string; index?: number };
  ```
- **규칙**:
  - 비-lab → `{ ok:false, message:"실험실 전용 기능입니다." }`.
  - 빈/무음 구간 → `{ ok:true, text:"" }`(전손 아님, 그 구간만 빈 결과).
  - Whisper 실패 → `{ ok:false, message }`(클라이언트가 1회 재시도 판단).
  - 전사문·오디오를 로그에 적재하지 않음(헌법 I).

## 2) `summarizeChunkTranscript(fullText: string): Promise<SummaryResult>`

이어붙인 **전체 전사문**을 Claude로 1회 요약(`SUMMARY_PROMPT` 재사용).

- **위치**: `app/actions/transcribe.ts`
- **입력**: `fullText: string` — 성공 구간 전사문을 순서대로 join한 전체 원문.
- **출력**:
  ```ts
  type SummaryResult =
    | { ok: true; summary: string }
    | { ok: false; message: string };
  ```
- **규칙**:
  - 비-lab → 거부.
  - 빈 입력 → `{ ok:false, message:"전사된 내용이 없습니다." }`.
  - 요약 실패 → `{ ok:false, message }`. (클라이언트는 폴백으로 원문 자체를 본문에 둘 수 있음 — 기존 패턴.)

## 클라이언트 오케스트레이션 계약 (consultation-board)

chunk 모드 `handleStop` 흐름(서버 액션 조합):
1. `segments = audioSegmentsRef.current` (분할 녹음 결과).
2. 종료 직후 `saveDraft({ ..., audioSegments: segments })` (복구 안전망).
3. 동시성 3으로 각 구간 `transcribeSegment(fd)` 호출. 실패 시 1회 재시도. 진행률 `done/total` 상태 갱신.
4. 성공 `text`를 index 순서로 join(실패 구간은 자리표시 또는 생략, `failedSegments` 기록).
5. `summarizeChunkTranscript(joined)` → summary. 실패 시 joined 원문을 본문으로 폴백.
6. `EngineRun{ engine:"chunk", transcription:joined, summary, insertText:summary, failedSegments }` 형태로 본문 삽입, `usedEngine="chunk"`.
7. 저장 시: `saveChairRecord({..., transcriptionEngine:"chunk"})` + 보관용 `uploadConsultationAudio(id, concat(segments))`(기존 단일 경로).

## 호환·불변
- 기존 `transcribeChairAudio(formData, mode)` 단일 경로는 **변경 없음**(basic/quick/detailed/dental/multilingual/comparison 그대로). chunk만 별도 오케스트레이션.
- DB 스키마/버킷/마이그레이션 변경 없음.
- 비-lab 회귀 0(신규 액션은 lab 게이트, picker의 chunk는 lab만 노출).
