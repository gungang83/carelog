# Implementation Plan: 긴 상담 청크 분할 전사 모드 (Chunked Transcription)

**Branch**: `010-chunked-transcription` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/010-chunked-transcription/spec.md`

## Summary

긴 상담 녹음을 통짜로 처리하던 batch 방식의 길이 천장·전손 문제를 해소하기 위해, 실험실 픽커에 **"긴 상담(청크)" 모드**를 추가한다. 핵심 기술 접근:

- **분할 녹음(클라이언트)**: 녹음 중 5분마다 `MediaRecorder`를 stop→즉시 restart 하여 **독립적으로 유효한 webm 구간 blob 배열**을 만든다(디코드/ffmpeg 불필요, 모바일 메모리 가벼움). 기존 단일 blob 경로는 그대로 두고 chunk 모드일 때만 분할.
- **구간별 전사(서버, 병렬+격리)**: 각 구간을 작은 서버액션 호출로 Whisper 전사. 동시성 제한(3), 실패 구간 1회 재시도, `allSettled`로 실패 격리. 각 호출이 작아 타임아웃·용량에 안전.
- **전체 통짜 요약**: 성공 구간 전사문을 순서대로 이어붙여 Claude 요약 **1회**(기존 `SUMMARY_PROMPT` 재사용) → 전체 맥락 보존.
- **진행률 UX**: 구간별 호출이라 "n/m 구간 전사 중" 자연 갱신.
- **복구 안전망**: `BoardDraft`에 구간 blob 배열을 임시 영속화 → 크래시 후 복구·재전사.
- **음성 보관(spec 009)**: 구간을 이어붙인 단일 blob을 기존 단일 경로로 업로드(스키마 유지, 마이그레이션 0). 청크 음성 재청취의 완전 재생 패리티는 v1 한계로 둠(전사가 1차 가치).

## Technical Context

**Language/Version**: TypeScript strict · Next.js 16.2.2 App Router · React 19
**Primary Dependencies**: 기존 OpenAI Whisper(`whisper-1`)·Anthropic Claude(`claude-sonnet-4-6`), 기존 녹음(`MediaRecorder`), 엔진 레지스트리(`lib/transcribe/engines.ts`). **신규 외부 의존성 0.**
**Storage**: Supabase Storage 기존 비공개 버킷 `consultation-audio`(spec 009). **스키마 변경 없음**(단일 `consultation.audio_path` 유지).
**Testing**: `npm run build` 그린 + 예미안(lab) 프로덕션 수동 검증(통짜 vs 청크 A/B, 30~40분 실측). 별도 테스트 하네스 없음(기존 정책).
**Target Platform**: Web PWA — PC/안드로이드 Chromium 우선(모바일 메모리 안전이 설계 동기).
**Project Type**: Web application (Next.js 풀스택, Server Actions + RSC).
**Performance Goals**: 5분 구간 1개 전사 호출이 maxDuration(300s)·bodySizeLimit(25mb) 안에서 여유 완료. 40분(=8구간)도 병렬로 체감 단축.
**Constraints**: Vercel 서버리스 호환(스테이트리스, 구간별 단명 호출) · 음성=민감정보(비공개 버킷·서명 URL 유지) · 비-lab 회귀 0 · 새 인프라 0.
**Scale/Scope**: 단일 의원~소규모. 1차는 lab(예미안) 검증용. 수정 파일 6개, 신규 서버액션 2개, 마이그레이션 0.

## Constitution Check

*GATE: Phase 0 전 통과. Phase 1 후 재확인.*

- [x] **I. Patient Privacy First** — `resident_no`/PII 무관. 음성=민감정보지만 기존 spec 009 정책(비공개 버킷·서명 URL·기관격리) 그대로. 전사문·음성을 로그에 적재하지 않음. 동의는 기존 기록 동의에 포함(변경 없음).
- [x] **II. Server-Side Data Authority** — 전사·요약은 신규 **Server Action**(`transcribeSegment`/`summarizeChunkTranscript`)에서만. 클라이언트는 녹음·구간 수집·호출 오케스트레이션·표시만. 두 신규 액션도 `getMyInstitutionLab()` 서버 게이트(비-lab 거부) → 클라이언트 신뢰 안 함.
- [x] **III. Clinical Reliability** — 신규 액션은 `{ ok, message }` 반환. **스키마 변경 없음 → 마이그레이션 불필요**(A안: 단일 경로 유지). 실패 격리로 데이터 손실 방지. 저장 경로(`saveChairRecord`)·`revalidatePath`는 기존 그대로(청크는 본문 생성까지만 관여).
- [x] **IV. Simplicity Over Abstraction** — 신규 서버액션 2개는 "구간 전사"·"전체 요약"이라는 구체 문제(여러 호출 사이트) 해결. 엔진 레지스트리·픽커·lab 게이트·draft-store 재사용. 피처 플래그/죽은 코드 없음. 분할 녹음·오케스트레이션의 복잡도는 기능 본질 → Complexity Tracking에 근거 기재.
- [x] **V. Spec-Driven Development** — `specs/010-chunked-transcription/spec.md` 존재·품질 체크리스트 통과(NEEDS CLARIFICATION 0).
- [x] **VI. Documentation as Living Artifact** — 갱신 대상: `project_status.md`(완료·검증), `docs/architecture.md`(분할 녹음 + 구간별 전사 + 통짜 요약 데이터 흐름). **`docs/database.md`·`supabase/schema.sql` 변경 없음**(스키마 불변). 마무리 프로토콜 준수.

## Project Structure

### Documentation (this feature)

```text
specs/010-chunked-transcription/
├── plan.md              # 본 파일
├── spec.md              # 기능 스펙
├── research.md          # Phase 0 — 분할/전달/보관/복구 결정
├── data-model.md        # Phase 1 — AudioSegment·ChunkRun·BoardDraft 확장
├── quickstart.md        # Phase 1 — A/B 검증 시나리오
├── contracts/
│   └── chunk-transcription.md   # 신규 서버액션 계약
└── checklists/requirements.md
```

### Source Code (repository root)

```text
lib/transcribe/engines.ts            # [수정] EngineId에 'chunk' 추가, LAB_ENGINE_OPTIONS에 "긴 상담"
app/actions/transcribe.ts            # [수정] transcribeSegment(구간 1개) + summarizeChunkTranscript(전체 요약) 신규
components/chair/chair-provider.tsx   # [수정] 분할 녹음(5분마다 stop→restart), audioSegments 배열 노출·리셋
components/chair/consultation-board.tsx # [수정] chunk 오케스트레이션(구간 전사·진행률·요약·복구 재전사·아카이브 concat 업로드)
lib/chair/draft-store.ts             # [수정] BoardDraft.audioSegments?: Blob[] 추가(복구 영속화)
components/consultation/voice-recorder.tsx # (변경 없음 — 구식 단일 경로, chunk 비대상)
```

마이그레이션·신규 버킷·신규 라이브러리 **없음**.

**Structure Decision**: 기존 Next.js 앱 확장. chunk는 "녹음(분할) → 구간별 서버액션 전사(병렬·격리) → 전체 요약 1회 → 본문 삽입"으로, 기존 단일 blob 경로와 **분기 공존**한다. 저장·보관·복구는 기존 자산 재사용(스키마 불변).

## Complexity Tracking

> Constitution IV 관련 — 단순성 원칙 대비 추가 복잡도의 정당화.

| 추가 요소 | 왜 필요 | 더 단순한 대안을 버린 이유 |
|---|---|---|
| 분할 녹음(stop→restart) | webm 통짜는 안전하게 분할 불가(헤더 1개) → 유효 구간을 만들려면 녹음 단계에서 분리 필요 | 바이트 분할=깨진 파일 / Web Audio 디코드=모바일 OOM / 서버 ffmpeg=Vercel 불가 |
| 구간별 서버액션 다중 호출 | 실패 격리·진행률·작은 업로드(타임아웃·메모리 안전)가 기능 목표 자체 | 단일 멀티파일 1회 호출=통짜 업로드/한 함수가 전부 전사 → 길이 천장 재발 |
| draft-store 구간 배열 | 분할 녹음물도 크래시 복구돼야 함(C-01 원칙) | 단일 blob만 저장하면 청크 녹음은 복구 불가 |
