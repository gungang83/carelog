# Phase 0 Research: 긴 상담 청크 분할 전사

기술 불확실성을 결정으로 해소한다. 형식: 결정 / 근거 / 기각한 대안.

## R1. 유효한 오디오 구간을 어떻게 만드나 (핵심 난제)

**Decision**: **분할 녹음** — 녹음 중 일정 간격(5분)마다 `MediaRecorder.stop()` → 즉시 `start(250)` 재시작하여, 매 구간이 **독립적으로 디코드/전사 가능한 완결 webm**이 되게 한다. getUserMedia 스트림·트랙은 유지(재권한 없음), 각 구간 완료 시 blob을 `segments[]`에 push하고 chunks 버퍼 리셋.

**Rationale**: webm 컨테이너 헤더는 첫 청크에만 있어 통짜를 바이트로 쪼개면 깨진다. 녹음 단계에서 끊어야 유효 파일이 나온다. stop→start 경계의 ~수십 ms 갭(음절 일부)은 임상 요약에 무의미한 수준으로 허용.

**Alternatives rejected**:
- timeslice 청크 재조합: 헤더 없는 청크 → 독립 디코드 불가.
- Web Audio `decodeAudioData` 후 재분할/재인코딩: 18~40분 PCM 디코드 = 수십~100MB+ → **모바일 OOM**(이 기능의 동기와 정반대).
- 서버 ffmpeg 분할: Vercel 서버리스에 ffmpeg 미탑재 + 통짜 업로드 선행 필요(천장 재발).

## R2. 구간 전송: 단일 멀티파일 1회 vs 구간별 다중 호출

**Decision**: **구간별 개별 Server Action 호출**(클라이언트 오케스트레이션, 동시성 3, 실패 시 1회 재시도). 신규 액션 `transcribeSegment(formData)`가 구간 1개를 Whisper 전사해 `{ ok, text }` 반환. 모든 구간 수집 후 `summarizeChunkTranscript(text)`로 요약 1회.

**Rationale**:
- **실패 격리**가 호출 단위로 자연 성립(한 호출 실패 = 그 구간만).
- **진행률**이 자연 갱신("n/m 완료").
- 각 호출 페이로드가 작아(5분·32kbps ≈ 1.2MB) bodySizeLimit(25mb)·maxDuration(300s)에 큰 여유 → 길이 천장 제거.
- 동시성 제한으로 API 레이트·서버리스 동시 함수 폭주 방지.

**Alternatives rejected**:
- 단일 액션에 멀티파일(audio_0..n) 1회 전송: 전체를 한꺼번에 업로드(통짜 메모리·용량 재현) + 한 함수가 N구간 전사 → 구간 많으면 타임아웃. 격리·진행률도 수동 구현 필요.

## R3. 크래시 복구(C-01 IndexedDB)와 구간 배열

**Decision**: `BoardDraft`에 `audioSegments?: Blob[]` 추가. chunk 녹음 종료 직후(전사 시작 전) 구간 배열을 즉시 영속화(세션 45의 "전사 전 저장" 패턴 확장). 복구 시 `applyRecover`가 본문이 비고 구간이 있으면 **청크 재전사**.

**Rationale**: 분할 녹음물도 단일 blob과 동일하게 크래시 후 살아나야 한다(헌법 III·C-01 원칙). 기존 `audioBlob` 단일 필드만으론 구간 녹음 복구 불가.

**Alternatives rejected**: 구간을 합쳐 단일 blob만 저장 → 부분 실패/재전사 시 구간 경계·격리 정보를 잃음. 배열 보존이 단순하고 안전.

## R4. 음성 원본 보관(spec 009) — 단일 경로 유지(A안)

**Decision**: 저장 시 구간 blob들을 **이어붙인 단일 blob**(`new Blob(segments, {type})`)을 기존 `uploadConsultationAudio`로 단일 경로 업로드 → `consultation.audio_path` **스키마 불변, 마이그레이션 0**. **청크 음성의 완전 재생 패리티는 v1 한계**로 명시(이어붙인 webm은 일부 플레이어에서 첫 구간만 재생될 수 있음). 전사·요약이 1차 가치이므로 수용.

**Rationale**: 다온 지시 = 스키마 변경(B) 회피. 재청취는 lab 검증 단계의 부차 기능. 보관 자체(전사 원본 보존)는 단일 blob으로 충족.

**Alternatives rejected**:
- B(구간 다중 파일 + 스키마/경로 규약 변경): 마이그레이션·재청취 로직 변경 유발 → 검증 단계엔 과함.
- 대표 구간만 보관: 음성 원본 유실 → 부적절.

> 후속(승격 시): 완전 재생이 필요하면 적정 컨테이너 병합 또는 다중 파일 보관을 별도 결정.

## R5. 상수·파라미터

**Decision**:
- 구간 길이 `SEGMENT_MS = 5 * 60 * 1000`(5분). 40분=8구간.
- 전사 동시성 `CHUNK_CONCURRENCY = 3`.
- 구간 전사 실패 재시도 `1회`.
- 비트레이트 32kbps·wake lock 등 세션 45 설정 유지.

**Rationale**: 5분 구간이면 호출당 ~1.2MB·전사 수~십초 → 타임아웃·용량 여유. 동시성 3은 진행률 체감과 레이트 안전의 균형.

## R6. Next 16 / Vercel 적합성

**Decision**: 추가 라우트 설정 불필요. 전사 액션은 홈(`app/(dashboard)/page.tsx`, maxDuration=300 page레벨)에서 호출 — 구간별 호출은 짧아 더 안전. bodySizeLimit 25mb는 구간 1개에 충분.

**Rationale**: 세션 45에서 page레벨 maxDuration·bodySizeLimit·비트레이트가 이미 정비됨. 청크는 그 위에서 더 작게 동작.

**확인 필요(구현 시)**: `node_modules/next/dist/docs` 참조(AGENTS.md) — Server Action이 page 설정을 따르는 점은 세션 45에서 문서로 확인됨(route-segment-config/maxDuration.md "set at the page level").
