---
description: "Task list — 음성 원본 보관 (Audio Archive)"
---

# Tasks: 음성 원본 보관 (Audio Archive)

**Input**: Design from `specs/009-audio-archive/`
**Tests**: 테스트 하네스 없음 → 빌드 그린 + quickstart 수동.
**Organization**: US1(보관·재청취 P1) → US2(등급 차등 P2) → US3(자동정리·감사 P3).

## Path Conventions
Next.js 앱 루트: `app/`, `components/`, `lib/`, `supabase/`.

---

## Phase 1: Setup
- [x] T001 빌드 베이스라인 확인(`npm run build` 그린).

## Phase 2: Foundational (Blocking)
- [x] T002 마이그레이션 `supabase/migrations/20260619000001_audio_archive.sql` — `institutions.plan`(check free/standard/pro/enterprise, default free), `consultation.audio_path`·`audio_uploaded_at`, `audio_replay_logs` 테이블+RLS(기관 직원 select/insert). 비공개 버킷 `consultation-audio` 생성·정책 가이드 주석. **schema.sql·database.md 동반 갱신.**
- [x] T003 `lib/supabase/config.ts`에 `audioBucket`('consultation-audio') 상수 추가.
- [x] T004 [P] `lib/plan.ts` 신규 — `PlanTier`·`retentionDays(plan)`·`freeRollingMax=3`·`canReplay`·`auditReplay`.
- [x] T005 [P] `lib/types/database.ts` — `ConsultationRow`(audio_path·audio_uploaded_at), `InstitutionRow.plan`, `AudioReplayLogRow`.

**Checkpoint**: 스키마·정책·타입 준비(대표님 마이그레이션·버킷 적용 필요).

## Phase 3: US1 — 보관·재청취 (P1) 🎯 MVP
- [x] T006 [US1] `app/actions/audio.ts` `uploadConsultationAudio(consultationId, formData)` — 기관검증 → 비공개 버킷 `{inst}/{id}.webm` upsert → consultation.audio_path·audio_uploaded_at 갱신. 비차단 {ok,message}.
- [x] T007 [US1] `app/actions/audio.ts` `getConsultationAudioUrl(consultationId)` — 권한·기관·보관여부 판정 → `createSignedUrl(path,60)`. 미보관/거부 사유 반환.
- [x] T008 [US1] `components/chair/consultation-board.tsx` — 중지 시 blob을 ref로 보존, 저장 성공(consultationId) 후 `uploadConsultationAudio` 호출(비차단). draft reset 시 blob 해제.
- [x] T009 [US1] `components/chair/audio-replay-button.tsx` 신규 — 클릭 시 `getConsultationAudioUrl`→`<audio controls>` 재생, 사유별 안내.
- [x] T010 [US1] `unlinked-records-section`(+ `consultation-history`)에 audio-replay-button 배치(audio 보유 시 노출).

**Checkpoint**: 저장 음성을 다른 기기에서 재청취(비공개·서명URL). MVP.

## Phase 4: US2 — 등급 차등 (P2)
- [x] T011 [US2] `uploadConsultationAudio`에 **free 롤링 정리** — 업로드 후 plan=free면 4번째 이후 audio 파일+audio_path 제거.
- [x] T012 [US2] `getConsultationAudioUrl`에 **등급 보존 판정** — standard 90일/pro·ent 365일 만료 검사, 만료면 expired 반환.
- [x] T013 [US2] 재청취 버튼/UI에 등급 게이트 사유 안내(만료·미보관) 반영.

**Checkpoint**: free 최근3 롤링 + standard/pro 보존기간 동작.

## Phase 5: US3 — 자동정리 + 감사 (P3)
- [x] T014 [US3] `app/api/cron/prune-audio/route.ts` 신규 — 등급별 만료 audio 삭제(파일+audio_path null), CRON_SECRET Bearer, admin. `vercel.json` crons 추가.
- [x] T015 [US3] `getConsultationAudioUrl`에서 pro/enterprise 재청취 시 `audio_replay_logs` insert(감사).

**Checkpoint**: 만료 자동삭제 + Pro 재청취 감사.

## Phase 6: Polish
- [x] T016 [P] `docs/architecture.md`·`docs/database.md` 갱신(오디오 저장·재청취·cron·테이블).
- [x] T017 [P] `project_status.md` 세션 항목.
- [x] T018 `npm run build` 그린.
- [x] T019 `quickstart.md` 검증(마이그레이션·버킷 적용 후, 프로덕션).
- [ ] T020 [P] (선택) 녹음 비트레이트 음성용(32kbps) 지정 — 용량 절감.

## Dependencies
- Setup → Foundational(T002~T005) → US1(T006→T007→T008→T009→T010) → US2(T011~T013) → US3(T014~T015) → Polish.
- T004·T005 병렬. T016·T017 병렬.

## Notes
- 음성=민감정보: 비공개·서명URL·기관격리·서버권위. 텍스트는 음성 삭제와 무관 영구.
- 재청취 감사는 chair_audit_logs 미사용(realtime 오발 방지) → audio_replay_logs.
- 마이그레이션·버킷·cron은 대표님이 Supabase/Vercel에 적용.
