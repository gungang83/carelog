---
description: "Task list — 실시간 체어 상담기록 알림"
---

# Tasks: 실시간 체어 상담기록 알림 (실시간 알림·소통 기반)

**Input**: Design documents from `specs/007-live-chair-alerts/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/realtime-events.md

**Tests**: 별도 자동 테스트 태스크 없음(스펙에 TDD 미요청 + 프로젝트에 테스트 하네스 부재). 검증은 `quickstart.md` 수동 절차 + `npm run build`.

**Organization**: 유저 스토리(US1/US2/US3)별 독립 구현·검증 가능하도록 묶음.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일, 미완 의존 없음)
- 경로는 repo 루트 기준.

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 [P] 알림 효과음 에셋 추가 `public/sounds/alert.mp3` (짧은 띵동, 가벼운 용량)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: 이 단계 완료 전 어떤 유저 스토리도 시작 불가. (Realtime publication + 구독 헬퍼)

- [ ] T002 마이그레이션 작성 `supabase/migrations/20260614000001_realtime_chair_audit_logs.sql` — `alter publication supabase_realtime add table public.chair_audit_logs;`
- [ ] T003 마이그레이션 Supabase 적용 + 대시보드 Database→Replication에서 `chair_audit_logs` realtime 포함 확인(배포 작업)
- [ ] T004 [P] 구독 헬퍼 신규 `lib/realtime/institution-events.ts` — `ChairAuditEvent` 타입(contracts §1) + `subscribeChairEvents({ institutionId, onEvent })`: 브라우저 클라이언트로 채널 `institution:{id}:chair-events` 생성, `postgres_changes` INSERT / `table:'chair_audit_logs'` / `filter:'institution_id=eq.{id}'` 구독, 구독 해제 함수 반환
- [ ] T005 [P] 스키마 문서 동기화 `supabase/schema.sql` + `docs/database.md` — `chair_audit_logs`의 realtime publication 포함 반영(헌법 VI)

**Checkpoint**: Realtime 인프라·헬퍼 준비 완료 → 유저 스토리 착수 가능

---

## Phase 3: User Story 1 — 실시간 토스트 + 목록 자동 갱신 (P1) 🎯 MVP

**Goal**: 체어 기록이 올라오면 같은 기관 열린 모든 화면에 토스트가 뜨고 미연결 기록 목록이 새로고침 없이 갱신(에코 방지·기관 격리·재연결 재동기화).

**Independent Test**: 같은 기관 두 화면에서 한쪽이 기록 저장 → 다른 쪽 5초 내 토스트+목록 갱신, 올린 본인은 토스트 없음, 타 기관 무반응.

- [ ] T006 [P] [US1] 토스트 UI `components/notifications/alert-toast.tsx` — "{체어명} · 상담 기록 도착" 표시, 수 초 후 자동 소멸, 환자정보·진료내용 미표시
- [ ] T007 [US1] 알림 프로바이더 `components/notifications/live-alerts-provider.tsx` — `subscribeChairEvents`(T004) 구독; `event_type==='record_created'`만 처리; `actor_user_id===currentUserId`면 토스트 생략 후 `router.refresh()`만(에코 방지); 아니면 디바운스(~1.5s)→토스트(T006)+`router.refresh()`; 채널 `SUBSCRIBED` 재진입 시 1회 `router.refresh()`(재연결). props로 `currentUserId`·`institutionId`·체어 이름맵 수신 (depends T004, T006)
- [ ] T008 [US1] 대시보드 레이아웃 마운트 `app/(dashboard)/layout.tsx` — `live-alerts-provider`를 인증 라우트에 마운트, 서버에서 `currentUserId`·`institutionId`·`chairs(id→name)` 조회해 전달(환자 포털/공개 라우트엔 미마운트) (depends T007)

**Checkpoint**: US1 단독 동작·검증 가능 (MVP)

---

## Phase 4: User Story 2 — 소리 안내 (P2)

**Goal**: 1회 활성화 후 새 기록 도착 시 효과음. on/off 토글, 디바운스, 미활성 시 무음(시각 알림만).

**Independent Test**: "소리 켜기" 탭 후 다른 화면이 기록 저장 → 효과음 재생. 활성화 전엔 무음+에러 없음. 연속 저장 시 소리 1회.

- [ ] T009 [P] [US2] 소리 활성화 버튼 `components/notifications/sound-arm-button.tsx` — 첫 탭에서 `AudioContext.resume()`(제스처 내) → `localStorage.soundArmed`; on/off 토글 → `localStorage.soundEnabled`(기본 on)
- [ ] T010 [US2] 효과음 재생 연동 `components/notifications/live-alerts-provider.tsx` — 토스트 발생 시 `soundArmed && soundEnabled`이면 `public/sounds/alert.mp3`(T001) 재생, 디바운스 창 내 1회만 (depends T007, T001)
- [ ] T011 [US2] 소리 버튼 배치 `components/layout/header.tsx` — `sound-arm-button`(T009)을 헤더에 노출(항상 띄워두는 화면에서 접근) (depends T009)

**Checkpoint**: US1+US2 독립 동작

---

## Phase 5: User Story 3 — 백그라운드 Web Push (P3)

**Goal**: 화면 꺼짐/백그라운드 기기에 새 체어 기록 OS 푸시(기존 인프라 재사용). 포그라운드 과중복 억제.

**Independent Test**: 푸시 허용·백그라운드 기기에서 다른 화면이 기록 저장 → OS 푸시 도착, 탭하면 홈 이동.

- [ ] T012 [US3] 푸시 발송 추가 `app/actions/chairs.ts` (`saveChairRecord`) — chair 조회 `select`에 `name` 추가, 저장·audit log 후 `void sendPushToInstitution(institutionId, { title:"새 상담 기록", body:`${chairName} · 상담 기록이 올라왔습니다`, url:"/" })` fire-and-forget. 반환 `{ok,message}` 형태·`revalidatePath` 불변(헌법 III)
- [ ] T013 [US3] 알림 클릭 동작 확인 `public/sw.js` — `notificationclick`이 `url`로 포커스/이동하는 기존 동작 재확인(필요 시 보정)

**Checkpoint**: 세 스토리 독립 동작

---

## Phase 6: Polish & Cross-Cutting

- [ ] T014 [US3] 포그라운드 중복 억제(FR-010) — 화면 포커스 시 인앱 토스트 우선, OS 푸시 과표시 억제 점검(`live-alerts-provider`/`sw.js` 포커스 체크)
- [ ] T015 [P] 문서 갱신 `docs/architecture.md` — Realtime 데이터 흐름, `lib/realtime/`·`components/notifications/` 신규, 대시보드 레이아웃 마운트 반영
- [ ] T016 [P] 문서 갱신 `project_status.md` — 세션 entry(실시간 체어 알림 구현·검증)
- [ ] T017 `npm run build` 그린 확인(타입·빌드 에러 0)
- [ ] T018 `quickstart.md` 수동 검증 실행(두 기기 — US1/US2/US3 + 재연결), 전송선·토스트·푸시에 PII/진료본문 없음 확인(헌법 I)

---

## Dependencies & Execution Order

### Phase 순서
- **Setup(P1)** → **Foundational(P2)** → **US1(P3)** → **US2(P4)** → **US3(P5)** → **Polish(P6)**
- Foundational(특히 T002·T003 publication, T004 헬퍼)은 **모든 US의 선행 차단조건**.

### 유저 스토리 의존
- **US1(P1)**: Foundational 후 착수, 타 스토리 비의존(MVP).
- **US2(P2)**: Foundational 후 가능하나 효과음 연동(T010)이 `live-alerts-provider`(T007)에 붙으므로 **실질적으로 US1 후**.
- **US3(P3)**: Foundational·US1 무관하게 독립 가능(`saveChairRecord` 서버 측). 병렬 착수 가능.

### 스토리 내부
- T006(토스트) → T007(프로바이더) → T008(마운트).
- T009(버튼)·T010(재생 연동)·T011(배치): T010은 T007 의존.

### 병렬 기회
- Setup T001 ∥ Foundational T004·T005(서로 다른 파일).
- US1의 T006 ∥ (US3의 T012는 서버 액션이라 US1과 독립 — 다른 개발자 병렬 가능).
- Polish T015 ∥ T016.

---

## Parallel Example

```
# Foundational 동시 진행:
T004 lib/realtime/institution-events.ts (구독 헬퍼)
T005 supabase/schema.sql + docs/database.md (publication 문서)
T001 public/sounds/alert.mp3 (에셋)

# US1과 US3 병렬(다른 파일·독립):
개발자 A: T006→T007→T008 (인앱 실시간)
개발자 B: T012 (saveChairRecord 푸시)
```

---

## Implementation Strategy

### MVP First (US1만)
1. Setup(T001) → Foundational(T002~T005) → US1(T006~T008)
2. **STOP & VALIDATE**: 두 화면 실시간 토스트+목록 갱신 확인
3. 배포/시연 (예미안 체감 핵심 — 소리·푸시 없이도 가치)

### Incremental Delivery
1. Foundational 완료 → 기반 준비
2. US1 → 검증 → 배포(MVP)
3. US2(소리) 추가 → 검증 → 배포
4. US3(푸시) 추가 → 검증 → 배포
5. Polish(문서·중복억제·빌드·quickstart)

---

## Notes
- [P] = 다른 파일·무의존. 같은 파일(`live-alerts-provider.tsx`는 T007/T010/T014가 순차) 충돌 주의.
- 실시간 구독은 **읽기 전용**(헌법 II), 쓰기는 기존 Server Action만. 전송선·토스트·푸시에 PII/진료본문 금지(헌법 I).
- DB 변경(T002)은 마이그레이션+스키마문서 동반(헌법 III·VI).
- 각 태스크/논리단위 후 커밋(빌드 그린 유지). 작업 브랜치 `claude/festive-planck-FCghV`.
