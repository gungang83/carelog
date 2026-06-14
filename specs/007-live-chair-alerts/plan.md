# Implementation Plan: 실시간 체어 상담기록 알림 (실시간 알림·소통 기반)

**Branch**: `claude/festive-planck-FCghV` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/007-live-chair-alerts/spec.md`

## Summary

체어에서 상담 기록(`consultation`, patient_id null + chair_id)이 생성되면, 같은 기관의 **열린 모든 직원 화면**이 즉시 토스트+목록갱신(US1)·소리(US2)로 알아차리고, 화면이 꺼진 기기는 Web Push(US3)로 보완한다.

**기술 접근(핵심 결정)**: 실시간 신호는 진료 본문이 든 `consultation`이 아니라 **`chair_audit_logs`의 `record_created` INSERT를 Supabase Realtime(postgres_changes)로 구독**한다. 이 테이블은 `chair_id`·`actor_user_id`·`consultation_id`만 담아 **진료/환자정보가 전송선에 실리지 않고**(헌법 I), `actor_user_id`로 **에코 방지**가 자연 해결된다. 실제 목록 데이터는 클라이언트가 `router.refresh()`로 서버에서 RLS 경유 재조회(헌법 II). Web Push는 기존 `sendPushToInstitution`을 `saveChairRecord`에 추가(fire-and-forget).

## Technical Context

**Language/Version**: TypeScript strict · Next.js 16.2.2 App Router(RSC 기본) · React 19
**Primary Dependencies**: `@supabase/ssr`(브라우저/서버 클라이언트), `@supabase/supabase-js` **Realtime**(신규 사용), `web-push`(기존), Tailwind v4
**Storage**: Supabase Postgres — `consultation`(체어 기록=patient_id null+chair_id), `chairs`(name=체어 라벨), `chair_audit_logs`(이벤트 원천), `push_subscriptions`(기존). **신규: `chair_audit_logs`를 `supabase_realtime` publication에 추가.**
**Testing**: `npm run build` 그린 + Vercel 프리뷰/프로덕션 수동 검증(두 기기 동시). 별도 테스트 하네스 없음(프로젝트 현 상태).
**Target Platform**: Web PWA — **PC/안드로이드 Chromium 브라우저 + 안드로이드 폰(보조)**. iOS는 v1 범위 밖.
**Project Type**: Web application(Next.js 풀스택, Server Actions + RSC)
**Performance Goals**: 기록 업로드 후 **5초 이내** 전 화면 알림(SC-001)
**Constraints**: 클라이언트 Realtime 구독은 **읽기 전용**(쓰기는 전부 Server Action) · 전송선에 PII/진료본문 0 · Vercel 서버리스 호환(Realtime는 브라우저↔Supabase 직결, 서버 상주 연결 없음)
**Scale/Scope**: 소규모(단일 의원, 체어·화면 수 개~수십). 컴포넌트 신규 2~3 + 액션 1곳 확장 + 마이그레이션 1.

## Constitution Check

*GATE: Phase 0 전 통과 필수. Phase 1 후 재확인.*

- [x] **I. Patient Privacy First** — 알림은 `chair_audit_logs`(체어ID·이벤트·작성자만) 구독으로 **진료본문·환자식별정보가 전송선·UI에 실리지 않음**. 토스트는 "체어 이름 + 도착 사실"만. `resident_no` 무관. metadata에 PII 미적재.
- [x] **II. Server-Side Data Authority** — Realtime 구독은 **읽기(subscribe)**로 클라이언트 허용. 모든 mutation은 기존 Server Action 유지(`saveChairRecord`). 목록 실제 데이터는 `router.refresh()`로 서버 재조회(RLS 경유). 브라우저 클라이언트는 구독 전용. RLS(기관 격리) 기존 정책 활용.
- [x] **III. Clinical Reliability** — `saveChairRecord`는 기존 `{ok,message}` 유지, 푸시는 **fire-and-forget**(기존 consultation 푸시와 동일 패턴, 저장 결과 비차단). `revalidatePath("/")` 기존 유지. DB 변경(publication)은 **마이그레이션 파일**로 동반.
- [x] **IV. Simplicity Over Abstraction** — 신규 추상화는 "기관 실시간 이벤트 구독 훅/프로바이더" 1개로 한정, **체어 이벤트에 구체 구현**하되 이벤트 타입 추가가 쉬운 최소 형태. 투기적 알림 프레임워크는 만들지 않음(FR-012는 "확장 용이"까지만).
- [x] **V. Spec-Driven Development** — `specs/007-live-chair-alerts/spec.md` 존재·검증 통과(NEEDS CLARIFICATION 0).
- [x] **VI. Documentation as Living Artifact** — 갱신 대상: `docs/architecture.md`(Realtime 데이터흐름·신규 프로바이더), `docs/database.md`+`supabase/schema.sql`(realtime publication 변경), `project_status.md`. 마무리 프로토콜 준수 예정.

## Project Structure

### Documentation (this feature)

```text
specs/007-live-chair-alerts/
├── plan.md              # 이 파일
├── research.md          # Phase 0 — 기술 결정
├── data-model.md        # Phase 1 — 엔티티/이벤트 모델
├── quickstart.md        # Phase 1 — 검증 절차
├── contracts/
│   └── realtime-events.md   # 실시간 이벤트·토스트·푸시 계약
└── tasks.md             # (/speckit-tasks 단계 — 이 명령에서 생성 안 함)
```

### Source Code (repository root)

```text
app/
├── actions/
│   └── chairs.ts                 # [수정] saveChairRecord에 sendPushToInstitution 호출 추가(fire-and-forget)
lib/
├── supabase/
│   └── client.ts                 # [재사용] createBrowserSupabaseClient — Realtime 구독에 사용
└── realtime/
    └── institution-events.ts     # [신규] 기관 이벤트 구독 헬퍼(채널명·필터·payload 타입) — 일반화 최소 단위
components/
├── chair/
│   └── chair-provider.tsx        # [재사용] chair_id→이름 매핑(이미 chairs 보유)
└── notifications/
    ├── live-alerts-provider.tsx  # [신규] chair_audit_logs(record_created) 구독 → 토스트 + router.refresh + 사운드(에코/디바운스)
    ├── alert-toast.tsx           # [신규] 토스트/팝업 UI
    └── sound-arm-button.tsx      # [신규] "🔔 알림 소리 켜기" 1회 활성화 + on/off
public/
└── sounds/
    └── alert.mp3                 # [신규] 알림 효과음(짧은 띵동)
supabase/
└── migrations/
    └── 2026XXXX_realtime_chair_audit_logs.sql  # [신규] supabase_realtime publication에 chair_audit_logs 추가
```

**Structure Decision**: 기존 Next.js 앱 확장. 실시간은 **클라이언트 프로바이더**(`live-alerts-provider`)가 대시보드 레이아웃에 마운트되어 기관 이벤트를 구독. `lib/realtime/institution-events.ts`에 채널/필터/타입을 모아 향후 이벤트 타입 확장 지점을 한 곳에 둔다(헌법 IV — 최소 일반화). 체어 이름은 기존 `chair-provider`에서 해결, 목록 갱신은 `router.refresh()`로 서버 권위 유지.

## Complexity Tracking

> 헌법 위반 없음 — 비움.
