# Phase 0 Research: 음성 원본 보관

## R1. 비공개 버킷 + 서명 URL (공개 URL 금지)
**Decision**: 신규 **비공개 버킷 `consultation-audio`**. 재청취는 Server Action이 권한·등급·만료를 판정한 뒤 `createSignedUrl(path, 60)`(60초 TTL)로 일시 링크 발급. 이미지용 `consultation-images`(public, getPublicUrl)와 **분리**.
**Rationale**: 음성=민감정보라 public 노출 불가(헌법 I). 짧은 TTL 서명 URL이면 링크 유출돼도 곧 만료. 경로 `{institution_id}/{consultation_id}.webm` + Storage RLS로 기관 격리.
**Alternatives**: public 버킷(기각 — PII 노출), 프록시 스트리밍 라우트(가능하나 서명 URL이 더 단순·서버리스 친화).

## R2. 업로드 시점·주체
**Decision**: 상담 **저장 후**(consultationId 확보) 보드가 보유한 blob을 `uploadConsultationAudio(consultationId, formData)` Server Action으로 업로드. 저장을 막지 않는 **비차단**(실패해도 텍스트 저장은 유효).
**Rationale**: consultationId가 있어야 경로·연결 가능. 버린 녹음 미업로드(프라이버시·비용). 보드는 이미 stopRecording blob을 가지므로 transcribe 후에도 **blob을 ref로 보존**했다가 저장 시 업로드.
**Note**: 기존 `stopRecording`은 blob 반환 후 chunks를 비움 — 보드에서 반환 blob을 ref에 저장해 재사용.

## R3. 등급 게이트(plan) 단일 출처
**Decision**: `lib/plan.ts`에 `PlanTier='free'|'standard'|'pro'|'enterprise'`와 정책 함수:
- `retentionDays(plan)`: free=null(롤링), standard=90, pro/enterprise=365(설정 여지).
- `freeRollingMax`: 3.
- `canReplay(plan)`: 모두 true(보존된 한에서).
- `auditReplay(plan)`: pro/enterprise만.
**Rationale**: 보존·재청취·감사 판정을 한 곳에. `institutions.plan` 컬럼이 DB 단일 출처, 헬퍼가 코드 단일 출처(헌법 IV).

## R4. free "최근 3개" 롤링
**Decision**: 업로드 성공 직후, plan=free면 해당 기관의 audio 보유 상담을 `audio_uploaded_at desc`로 조회해 **4번째 이후의 audio_path를 비우고 Storage 파일 삭제**. 텍스트는 유지.
**Rationale**: 업로드 시점 정리가 가장 단순·즉각(별도 cron 불필요). 경계(정확히 1개 정리)도 자연.

## R5. 만료 정리(retention) — cron
**Decision**: 신규 `app/api/cron/prune-audio/route.ts`(일 1회, `vercel.json` crons, CRON_SECRET Bearer 보호 — 기존 sync-master 패턴 재사용). standard(90일)·pro(365일) 초과 audio를 삭제(파일+audio_path null). free는 업로드 롤링이 처리하나 cron도 방어적으로 3개 초과 정리.
**Rationale**: 기간 만료는 시간경과 트리거라 cron이 적합. 기존 cron 인증·구조 재사용(헌법 IV).

## R6. 재청취 감사 — 별도 테이블 (chair_audit_logs 미사용)
**Decision**: 신규 `audio_replay_logs(id, institution_id, consultation_id, user_id, played_at)`. pro/enterprise 재청취 시 1건 insert. **chair_audit_logs를 쓰지 않는다** — 그 테이블은 `supabase_realtime` publication에 있어, 재청취 로그가 **실시간 토스트/소리를 오발**시킨다(spec 007).
**Rationale**: realtime 오염 방지(헌법 I·III). 작은 테이블 1개 추가는 정당(IV 위배 아님).

## R7. 권한·기관 격리
**Decision**: 재청취/업로드 Server Action은 `getMyInstitutionId()`로 호출자 기관 확인 → 대상 consultation의 institution_id 일치 검증 → 그 기관 plan으로 만료 판정 → 일치 시에만 서명 URL. Storage 정책(RLS)도 경로 prefix=기관으로 이중.
**Rationale**: 서버 권위(II) + 기관 격리(I). 다른 기관·비직원 접근 0(SC-002).

## R8. 동의·법적
**Decision**: 음성 보관 동의는 기존 진료/기록 동의에 "음성 보관 포함" 문구로 충족(가정). **의료법상 음성 보존의무·동의형식 최종판단은 미결(운영 확인)**. 보존기간 차등은 "음성=부가 백업, 텍스트=의무기록" 전제.
**Rationale**: 스펙 가정 유지. 법적 판단은 코드 외 영역이라 미결로 명시.

## R9. 용량 절감(선택)
**Decision**: MediaRecorder에 `audioBitsPerSecond` 음성용(예 32000) 지정 검토 — 용량을 0.25MB/분 수준으로. 단 호환·품질 영향 있어 별도 작은 작업(선택).
**Rationale**: 저장비용·전송 절감. 필수 아님 → tasks에서 선택 처리.

---

**모든 NEEDS CLARIFICATION 해소.** 미결(법적 음성보존)은 코드 외 운영 사항으로 명시 유지 → Phase 1 진행.
