# Implementation Plan: 음성 원본 보관 (Audio Archive)

**Branch**: `claude/amazing-fermi-bk359u` (spec dir `009-audio-archive`) | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/009-audio-archive/spec.md`

## Summary

상담 녹음 원본을 **비공개 Supabase Storage 버킷**에 보관하고, 기관 등급(`institutions.plan`: free/standard/pro/enterprise)에 따라 **보존기간·재청취**를 차등한다. 재청취는 **짧은 TTL 서명 URL**로만(공개 URL 금지). 텍스트 차트는 음성과 무관하게 영구. 정책 출처는 `docs/pricing-tiers.md`.

**기술 접근(핵심 결정)**:
- **저장**: 신규 **비공개 버킷 `consultation-audio`**(이미지용 public 버킷과 분리). 경로 `{institution_id}/{consultation_id}.webm`로 기관 격리.
- **업로드 시점**: 상담 **저장 후**(consultationId 확보 시) 보드가 들고 있던 blob을 Server Action으로 업로드. 버린 녹음은 업로드 안 함.
- **등급 게이트**: `lib/plan.ts`의 정책 해석(보존일수·free 롤링 상한·재청취 가능·감사 여부)을 단일 출처로. free=최근 3개 롤링(업로드 시 정리), standard=90일·pro/enterprise=365일+(cron 정리).
- **재청취**: Server Action이 권한·등급·만료 판정 후 **서명 URL(예 60초)** 발급 → 클라이언트 `<audio>` 재생. pro 이상은 별도 `audio_replay_logs`에 기록(**chair_audit_logs 미사용** — realtime publication에 있어 토스트 오발 방지).
- **정리**: free 롤링은 업로드 시 즉시, standard/pro 만료는 **신규 cron `/api/cron/prune-audio`**(일 1회)로. 삭제 시 텍스트는 보존, `audio_path=null`.

## Technical Context

**Language/Version**: TypeScript strict · Next.js 16.2.2 App Router · React 19
**Primary Dependencies**: Supabase Storage(신규 비공개 버킷·서명 URL `createSignedUrl`), `@supabase/ssr`/admin(service role), 기존 녹음(MediaRecorder)·`saveChairRecord`. 신규 라이브러리 없음.
**Storage**: Supabase Postgres + Storage. **신규 마이그레이션**: `institutions.plan`, `consultation.audio_path`·`audio_uploaded_at`, `audio_replay_logs` 테이블, RLS·Storage 정책. **신규 비공개 버킷 `consultation-audio`**(대시보드/SQL 생성).
**Testing**: `npm run build` 그린 + Vercel 프로덕션 수동 검증(quickstart). 별도 테스트 하네스 없음.
**Target Platform**: Web PWA — PC/안드로이드 Chromium 우선.
**Project Type**: Web application(Next.js 풀스택, Server Actions + RSC)
**Performance Goals**: 재청취 서명 URL 발급 즉시(<1s 체감), 업로드는 저장 비차단(fire-and-forget 허용).
**Constraints**: 음성=민감정보 → 비공개·서명 URL·기관격리·서버 권위 · 텍스트 의무기록은 음성과 분리 영구 · Vercel 서버리스 호환(cron) · 토큰/빌링은 범위 밖.
**Scale/Scope**: 단일 의원~소규모. 신규 컴포넌트 1(재청취 버튼) + 액션 1파일 + plan 헬퍼 + cron 1 + 보드/오버레이 업로드 배선 + 마이그레이션 1.

## Constitution Check

*GATE: Phase 0 전 통과 필수. Phase 1 후 재확인.*

- [x] **I. Patient Privacy First** — 음성=민감정보. **비공개 버킷 + 짧은 TTL 서명 URL**(공개 URL 금지), 경로·RLS·Storage 정책으로 **기관 격리**. 재청취 권한·만료는 서버 판정. 로그에 음성/PII 미적재. 동의는 기존 기록 동의에 음성 보관 포함(미결: 법적 최종판단). `resident_no` 무관. 실시간 알림 경로(chair_audit_logs)에 음성 미적재 — 재청취 감사는 **별도 테이블**(realtime publication 미포함).
- [x] **II. Server-Side Data Authority** — 업로드·삭제·서명 URL 발급·재청취 권한판정·plan 조회는 모두 **Server Action/admin**. 클라이언트는 `<audio>` 재생만. RLS(기관 격리) + Storage 정책 병행.
- [x] **III. Clinical Reliability** — 액션은 `{ok,message}`. **텍스트 차트는 음성 삭제와 무관하게 보존**(audio_path만 null). 스키마 변경은 **마이그레이션 동반**. 업로드 실패는 저장을 막지 않음(저장은 이미 완료, 음성은 보조).
- [x] **IV. Simplicity Over Abstraction** — Storage·cron·admin 패턴 재사용. plan 게이트는 `lib/plan.ts` 1곳. 재청취 감사만 위해 신규 테이블 1개(작지만 realtime 오염 방지 위해 정당). 투기적 빌링/모듈 프레임워크 없음(범위 밖).
- [x] **V. Spec-Driven Development** — `specs/009-audio-archive/spec.md` 존재·검증 통과(NEEDS CLARIFICATION 0).
- [x] **VI. Documentation as Living Artifact** — 갱신: `docs/database.md`+`supabase/schema.sql`(스키마·버킷·정책), `docs/architecture.md`(오디오 저장·재청취·cron 흐름), `project_status.md`. 마무리 프로토콜 준수.

## Project Structure

### Documentation (this feature)

```text
specs/009-audio-archive/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/audio-archive.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
supabase/
└── migrations/
    └── 20260619000001_audio_archive.sql   # [신규] institutions.plan, consultation.audio_*,
                                            #        audio_replay_logs, RLS·Storage 정책, 버킷 가이드
lib/
├── plan.ts                                # [신규] PlanTier·retention 정책(보존일·롤링상한·재청취·감사)
├── supabase/config.ts                     # [수정] audioBucket 상수 추가('consultation-audio')
└── types/database.ts                      # [수정] ConsultationRow(audio_path·audio_uploaded_at),
                                            #        InstitutionRow.plan, AudioReplayLogRow
app/
├── actions/
│   └── audio.ts                           # [신규] uploadConsultationAudio / getConsultationAudioUrl
│                                          #        (+ 내부 free 롤링 정리, pro 재청취 감사)
└── api/cron/
    └── prune-audio/route.ts               # [신규] 등급별 만료 음성 정리(일 1회), CRON_SECRET 보호
components/
├── chair/
│   ├── consultation-board.tsx             # [수정] 저장 후 blob 업로드(보드가 blob 보유)
│   ├── chair-overlay.tsx                  # [수정] per-chair 저장 후 업로드(선택)
│   └── audio-replay-button.tsx            # [신규] 서명 URL 받아 <audio> 재생(등급·권한 게이트)
└── (재청취 배치) unlinked-records-section / consultation-history
vercel.json                                # [수정] crons에 prune-audio 추가
```

**Structure Decision**: 기존 Next.js 앱 확장. 저장은 **비공개 버킷 + 서명 URL**로 프라이버시를 지키고, 등급 게이트는 `lib/plan.ts` 한 곳에 모은다. 업로드는 저장 후 보조 단계(비차단), 정리는 free 롤링(즉시)+standard/pro cron(일 1회). 재청취 감사는 realtime 오염을 피해 별도 테이블. MVP(US1)는 업로드+재청취까지, US2 등급 차등, US3 cron·감사.

## Complexity Tracking

> 헌법 위반 없음 — 비움. (재청취 감사용 신규 테이블 1개는 realtime publication 오염 방지를 위한 최소 선택으로 IV 위배 아님.)
