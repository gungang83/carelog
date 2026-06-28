# Implementation Plan: 알림함 (Notification Inbox)

**Branch**: `012-notification-inbox` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)
**Input**: `specs/012-notification-inbox/spec.md` + EO 벤치마크(읽기전용 교차검증: NotificationBell.tsx, lib/notifications.ts, api/notifications/*, notifications+notification_reads 2테이블)

## Summary

직원 대상 이벤트(새 상담 기록 저장 등)를 **영속 알림으로 적재**하고, 헤더 종 + 드롭다운 알림함 + 유저별 읽음관리를 제공한다. EO 설계를 Carelog 멀티테넌트(institution_id·RLS·PWA)에 맞춰 포팅:

- **2테이블 분리**: `notifications`(broadcast 본문) + `notification_reads`(유저별 읽음=행 존재). 읽음=upsert, 안읽음=delete, 전체읽음=미읽음 dedup 일괄 upsert.
- **생성 통합**: `sendNotification()` 한 호출이 알림 적재 + 기존 `sendPushToInstitution` 발송을 함께 수행. 기존 푸시 호출부(saveChairRecord·saveConsultation)에 배선.
- **실시간**: `notifications`를 `supabase_realtime` publication에 추가 + 브라우저 구독(`institution_id` 필터, 기존 `subscribeChairEvents` 패턴 재사용) + 30초 폴백 + PWA `setAppBadge`.
- **격리·대상**: RLS(기관 멤버 read, 읽음 본인만) + recipients 필터(all / admins=role admin / 이메일==본인).

## Technical Context

**Language/Version**: TypeScript strict · Next.js 16.2.2 App Router · React 19
**Primary Dependencies**: Supabase(Postgres·RLS·Realtime), 기존 웹푸시(`sendPushToInstitution`, VAPID), 기존 브라우저 클라(`createBrowserSupabaseClient`)·세션(`getSessionUser`)·기관(`getMyInstitutionId`). **신규 외부 의존성 0.**
**Storage**: Supabase Postgres. **신규 테이블 2개**(`notifications`, `notification_reads`) + RLS + realtime publication 추가. schema.sql·database.md 동반.
**Testing**: `npm run build` 그린 + 예미안 수동 검증. 별도 하네스 없음.
**Target Platform**: Web PWA — PC/안드로이드 Chromium. PWA `setAppBadge`(지원 기기).
**Project Type**: Web app(Next.js 풀스택, RSC + Route Handler).
**Performance Goals**: 알림함 열람 즉시(<1s), 새 알림 실시간 수초 내 반영.
**Constraints**: 기관 격리·서버 권위(RLS + 서버 경유) · 환자 PII 평문 미노출 · 기존 실시간 토스트/헤더 회귀 0 · Vercel 서버리스.
**Scale/Scope**: 단일~소규모 의원. 최근 50건 노출. 신규 파일 약 6 + 마이그레이션 1 + 배선 2.

## Constitution Check

- [x] **I. Patient Privacy First** — 알림 본문에 환자 주민번호 등 PII 평문 미적재(제목·요약 수준만, 예 "새 상담 기록이 저장됐어요"). realtime 전송선에 PII 0. `notification_reads`는 user_id만.
- [x] **II. Server-Side Data Authority** — 알림 적재·조회·읽음은 Route Handler/서버(lib/notifications) 경유. 클라이언트는 fetch + 표시 + 본인 읽음 토글만. RLS(기관 read, 읽음 본인) + 서버 이중.
- [x] **III. Clinical Reliability** — 알림은 보조(상담 데이터 불변). 액션은 `{ok}` 형태. **신규 스키마는 마이그레이션 동반 + schema.sql/database.md 갱신**. 멱등(읽음 upsert·전체읽음 dedup)로 오류 방지. 알림 적재 실패가 상담 저장/푸시를 막지 않음(비차단).
- [x] **IV. Simplicity Over Abstraction** — `lib/notifications.ts` 한 곳에 생성/조회/읽음 집약. realtime 구독은 기존 `institution-events.ts`에 함수 추가(한 곳). EO의 Sheets 폴백·이메일/SMS 채널·정책 테이블은 **제외**(범위 축소). 피처플래그 없음.
- [x] **V. Spec-Driven Development** — `specs/012-notification-inbox/spec.md` 존재·품질 통과.
- [x] **VI. Documentation as Living Artifact** — 갱신: `supabase/schema.sql`+`docs/database.md`(신규 2테이블·RLS·publication), `docs/architecture.md`(알림 흐름·NotificationBell·realtime), `project_status.md`. 마무리 프로토콜 준수.

## Project Structure

```text
specs/012-notification-inbox/
├── plan.md · spec.md · research.md · data-model.md · quickstart.md
├── contracts/notification-api.md
└── checklists/requirements.md

supabase/migrations/
└── 20260628000001_notifications.sql      # [신규] notifications·notification_reads·RLS·publication
lib/
├── notifications.ts                       # [신규] sendNotification/getNotifications/markRead/markUnread/markAllRead
├── realtime/institution-events.ts         # [수정] subscribeNotifications 추가(기존 패턴)
└── types/database.ts                      # [수정] NotificationRow·NotificationReadRow
app/api/notifications/
├── route.ts                               # [신규] GET 목록
├── [id]/read/route.ts                     # [신규] POST 읽음 / PATCH 안읽음
└── read-all/route.ts                      # [신규] POST 전체읽음
components/
├── notifications/notification-bell.tsx    # [신규] 종+배지+드롭다운(EO UX 포팅, Carelog 팔레트)
└── layout/header.tsx                      # [수정] NotificationBell 배치(RefreshButton 옆)
app/actions/
├── chairs.ts                              # [수정] saveChairRecord → sendNotification 배선
└── consultations.ts                       # [수정] saveConsultation → sendNotification 배선
supabase/schema.sql · docs/database.md · docs/architecture.md  # [수정] 동반 갱신
```

**Structure Decision**: 기존 Next.js 앱 확장. EO와 동일한 2테이블·4API·벨 구조를 Carelog 멀티테넌트·RLS·PWA에 매핑. realtime은 기존 `institution-events.ts`에 구독 함수 1개 추가(한 곳 집약). 생성은 `lib/notifications.ts`로 단일화하고 기존 푸시 호출부에 배선.

## Complexity Tracking

| 추가 요소 | 왜 필요 | 더 단순한 대안 기각 이유 |
|---|---|---|
| 신규 2테이블 | 메시지/읽음상태 분리 = 유저별 독립 읽음(broadcast 알림의 본질) | 단일 테이블+per-user 복제는 broadcast 비효율·정합 어려움 |
| realtime publication 추가 | 새 알림 즉시 반영(수동 새로고침 제거) | 폴링만으론 지연·부하 — 단 폴백 폴링은 유지 |
| Route Handler 4개 | 클라 벨이 fetch로 소비(EO 동형) — 서버 권위·RLS | 서버액션도 가능하나 EO 동형·fetch 폴링/실시간과 자연스러움 |
