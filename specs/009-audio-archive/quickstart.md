# Quickstart: 음성 보관 검증 절차

수용 시나리오(spec) ↔ 수동 검증. 환경: Vercel 프로덕션, PC/안드로이드 Chromium.

## 사전 (대표님 — Supabase)
- [ ] 마이그레이션 `20260619000001_audio_archive.sql` 적용(institutions.plan·consultation.audio_*·audio_replay_logs·RLS).
- [ ] **비공개 버킷 `consultation-audio`** 생성(public OFF) + Storage 정책.
- [ ] `vercel.json` cron 반영(prune-audio) + 필요 시 `CRON_SECRET`.
- [ ] 테스트 기관 plan 설정(free/standard/pro로 바꿔가며 검증).

## P1 — 보관·재청취 (어디서나)
1. A 기기에서 상담 녹음→저장 → ✅ 음성이 비공개 버킷에 업로드, consultation.audio_path 채워짐 (AS1)
2. B 기기(같은 기관 직원)에서 그 상담 열어 "음성 듣기" → ✅ 재생됨 (SC-001, AS2)
3. 비로그인/다른 기관에서 서명 URL·직접 경로 접근 → ✅ 불가(만료/거부) (SC-002, AS3)
4. 텍스트 기록은 음성과 별개로 그대로 (AS4)

## P2 — 등급 차등
1. free 기관에서 음성 4번 저장 → ✅ 최근 3개만 재청취, 가장 오래된 1개 사라짐(텍스트 4건 유지) (SC-003, AS1)
2. standard 기관 90일 경과 음성 → ✅ 만료 안내, 재청취 불가(텍스트 유지) (AS2)
3. pro 기관 보존기간 내 → ✅ 재청취 (AS3)
4. 못 듣는 상태 → ✅ 사유 안내(만료/미보관) (SC-008, AS4)

## P3 — 자동 정리 + 감사
1. cron 1회 실행(또는 수동 호출) → ✅ 만료 음성 삭제, audio_path null, 텍스트 유지 (SC-004, AS1)
2. pro 기관에서 재청취 → ✅ audio_replay_logs 1건(사용자·시각·상담) (SC-006, AS2)
3. 감사 조회 → ✅ 이력 확인, 음성/PII 미적재 (AS3)

## 엣지
- 버린 녹음 → 업로드 안 됨
- 업로드 실패 → 텍스트 저장은 유효(비차단)
- 등급 변경(free→standard) → 이후 새 정책, 과거 정리분 복구 불가

## 빌드/배포 게이트
- `npm run build` 그린
- 마이그레이션·버킷·cron 적용 후 위 시나리오 검증
- ⚖️ 법적 음성 보존의무는 운영 확인(미결)
