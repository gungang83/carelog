# 핸드오프 카드 238 — 세션 인계 (다온 → 다온 새 세션)

```
┌─ 핸드오프 카드 238 ──────────────────────────────────
[발신→수신] 다온(현 세션) → 다온(새 세션)
[성격]      🟡 일반 · 세션인계 · 조사+개선
[지시]      이 카드 + specs/007 읽고, 체어 녹음 신뢰성 "원인 확정"부터.
[착수 전]   ⛔ 대표님 실기기 녹음 실패 화면문구(녹음 N초·KB)=핵심 미결. 회신 와야 처방 확정.
[관련]      spec 007(live-chair-alerts) · EO연동 카드235~237 · 배포전속=다온
└──────────────────────────────────────────────────────
```

> 새 세션은 메모리가 없으므로 아래를 SSOT로 본다. 정체성·루틴은 `CLAUDE.local.md`(커밋됨), 운영규칙은 `PLAYBOOK.md`+`CLAUDE.md`.

## 1. 한 줄 현황

EO 연동 + 실시간 체어 알림(spec 007)까지 **프로덕션 라이브**. 지금 열린 일은 **체어 녹음이 iOS에서 간헐적으로 유실/미저장되는 문제의 원인 확정** — 진단 계측을 배포해두고 **대표님 실기기 화면문구 회신을 대기 중**.

## 2. 이번 세션에서 완료(배포됨)

- **EO↔Carelog 연동 라이브** — 마스터 게이트웨이 캐시 + SSO 작성자 귀속. 예미안(`0e4e85d6`) 직원 30명 동기화 확인. (카드 235~237, 빌 검증완료 회신)
- **spec 007 실시간 체어 알림 라이브** — 체어 기록 올라오면 같은 기관 열린 화면에 토스트+목록갱신(US1)·소리(US2)·백그라운드 Web Push(US3). `chair_audit_logs` Realtime 구독(진료본문 미전송). 마이그레이션 적용·검증 완료.
- **배포 중 fix 3건**: cron 미들웨어 우회, 사운드 에셋 미들웨어 제외, 녹음 실패 진단 계측.

## 3. ⛔ 지금 열린 일 — 체어 녹음 신뢰성 (최우선)

**증상(대표님 보고)**: ① 아이폰서 녹음 단계 많음(체어선택→녹음시작→마이크허용) ② 가끔 녹음이 하나도 안 됨(휴대폰 꺼져서?) ③ 방금 녹음했는데 소리도 안 나고 목록에 안 뜸(새로고침해도).

**구동방식(확인됨)**: 녹음=**로컬 브라우저 `MediaRecorder`**가 기기 메모리에 모음 → 중지 시 서버 업로드→OpenAI 전사·요약 → **"임시 저장" 눌러야** DB(`consultation`, patient_id null+chair_id) 저장 + `chair_audit_logs` insert(이때 실시간 소리 발생).

**진단(현 세션 결론)**: ②③은 **같은 원인일 가능성 높음** — iOS가 화면잠금/백그라운드 시 마이크·MediaRecorder를 정지 → **빈 녹음 → 전사 실패 → 저장 안 됨 → 목록·소리 없음**. Wake Lock 방어는 있으나 iOS서 불완전. ("임시 저장" 미클릭 가능성도 있음.)

**해둔 것**: 진단 계측 배포(커밋 `c81a4ef`). 이제 실패 시 화면에 원인이 뜬다:
- `components/chair/chair-overlay.tsx` `handleStopRecording` — blob<1KB면 "녹음이 비어 있어요 (N초·KB)…" 표시, 전사 실패엔 길이·용량 첨부.
- `app/actions/chairs.ts` `saveChairRecord` — insert 실패 시 실제 DB에러 노출+로그.

**회신 해석표 (대표님 문구 받으면)**:
| 화면 문구 | 원인 | 처방 |
|---|---|---|
| "녹음이 비어 있어요 (N초·0KB)" | iOS 화면잠금/백그라운드로 녹음 정지 | 신뢰성: 녹음 중 화면유지 강제·경고, (큰작업)청크 주기 업로드 |
| "전사 실패 (N초·○○KB): 음성을 인식 못함" | 녹음은 됨, 인식 실패 | 마이크/코덱/잡음 쪽 |
| "기록 저장에 실패했습니다 (DB에러…)" | 전사 OK, 저장 실패 | RLS/스키마 |
| "저장됨 ✓" 떴는데 목록 없음 | 저장 성공인데 안 보임 | getAllUnlinkedRecords/실시간 쿼리 조사 |

## 4. 다음 액션 후보 (원인 확정 후 착수, 대표님 우선순위 "원인 먼저 정밀조사" 선택함)

1. **[신뢰성·유력]** 빈 녹음 방지 — Wake Lock 강화 + "화면 끄지 마세요" 강경고 + (검토)녹음 청크 주기 업로드로 유실 최소화.
2. **[UX] 원탭 녹음** — 마지막 쓴 체어 기억 → 홈에서 "녹음 시작" 한 번에 시작. 마이크 허용은 OS보안이라 못 없애나 **PWA 홈설치 시 1회만** 물음 → 설치 안내.
3. **[UX] 전사 후 자동 임시저장** — "임시 저장" 누락 방지.
   → 규모상 spec 006 보완 또는 새 `specs/008-chair-record-reliability`로 끊기 권장.

## 5. 백로그/파킹 (방향만 잡힘)

- **성장축: 상담 데이터 → 경영관리·CRM** — 방향 문서 `docs/consult-analytics-crm-vision.md`, `roadmap.md` 다음 단계. 1단계 후보 `specs/007`이 아니라 `specs/008-consult-outcomes`(상담 결과/유형 필드+성공률). ⚠️ 번호 충돌 주의: 007은 이미 live-chair-alerts. 새 spec은 008부터.
- spec 007 **T018 실기기 검증** 미완(두 기기 토스트/소리/푸시 + 재연결). quickstart 참고.
- (선택) `CRON_SECRET` 하드닝 — sync-master 공개 상태(카운트만 노출, 위험 낮음).
- (확인) SSO 작성자 귀속 실사용 1회 — EO "케어로그 열기"→상담저장→`author_employee_id` 채워지는지.

## 6. 브랜치·배포 상태

- 작업 브랜치 **`claude/festive-planck-FCghV`** (= 현 세션 전부 여기). `main` `9c8d0cd` · `dev` `8473dc0` · `work` `c81a4ef` (전부 동기화·라이브).
- **배포 전속=다온**. 배포 루틴: 머지 직전 `git config merge.ours.driver true` 1회 → work→`dev`→`main` 머지 → `git push origin main`(Vercel 자동배포). 프로덕션 URL **`https://carelog-tau.vercel.app`**.
- DB 변경은 **마이그레이션 파일 + 대화창에 SQL 직접 출력**(원격 web 세션이라 대표님이 Supabase SQL Editor에 실행).

## 7. 핵심 파일 포인터

- 녹음 엔진: `components/chair/chair-provider.tsx`(MediaRecorder·Wake Lock), 오버레이/저장: `components/chair/chair-overlay.tsx`, 서버: `app/actions/chairs.ts`(`saveChairRecord`/`getAllUnlinkedRecords`/`transcribeChairAudio`), 전사: `app/actions/transcribe.ts`.
- 실시간 알림: `lib/realtime/institution-events.ts`, `components/notifications/{live-alerts-provider,alert-toast,sound-arm-button,alert-sound}`, 마운트 `app/(dashboard)/layout.tsx`.
- 인증 미들웨어 공개경로: `lib/supabase/middleware.ts`(`/api/cron/` 포함), 매처 `proxy.ts`(`sounds/`·mp3/wav 제외).

---

> **새 세션 다온 첫 행동**: (1) 대표님께 "체어 녹음 재현 시 화면 문구(N초·KB) 알려달라" 확인 → (2) §3 해석표로 원인 확정 → (3) §4에서 처방 골라 spec/구현. 서두르지 말 것 — 원인 먼저.
