# Implementation Plan: Carelog PWA + 푸시 알림

**Branch**: `main` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/004-pwa-push-notifications/spec.md`

## Summary

Carelog 웹앱을 PWA로 전환하여 홈 화면 추가, 항시 로그인, 푸시 알림(Web Push/VAPID)을 지원한다.
헤더를 항상 고정하고 새로고침 버튼을 추가하며, 모든 페이지에 "SUWANT holdings Inc." 푸터를 표시한다.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 16.2.2 App Router  
**Primary Dependencies**: `web-push` (VAPID 기반 Web Push), Supabase Auth (세션 관리)  
**Storage**: Supabase PostgreSQL — `push_subscriptions` 테이블 신규 추가  
**Testing**: 브라우저 DevTools (Application > Service Workers, Notifications)  
**Target Platform**: iOS 16.4+, Android Chrome, Desktop Chrome/Edge  
**Project Type**: Web PWA (Progressive Web Application)  
**Performance Goals**: 알림 발송 5초 이내, SW 등록 첫 방문 1회  
**Constraints**: HTTPS 필수(Vercel 배포), Service Worker는 `public/sw.js` 정적 파일  
**Scale/Scope**: 기관당 최대 수십 명 직원, 기관별 푸시 발송

## Constitution Check

- [X] **I. Patient Privacy First** — `push_subscriptions`는 PII 없음. 알림 payload에 환자 이름 포함되나 미리보기(80자)만 전송. 동의는 브라우저 권한 허용으로 대체.
- [X] **II. Server-Side Data Authority** — `subscribePush`, `unsubscribePush`, `sendPushToInstitution` 모두 Server Action. 클라이언트는 구독 객체를 서버로 전달만 함.
- [X] **III. Clinical Reliability** — 모든 Server Action `{ ok, message }` 반환. 푸시 발송 실패는 상담 저장에 영향 없음(비동기 fire-and-forget, 실패 로깅만).
- [X] **IV. Simplicity Over Abstraction** — SW 직접 작성(Workbox 미사용), manifest.ts 단일 파일, 새 컴포넌트는 RefreshButton·PushNotificationBanner·Footer 3개만.
- [X] **V. Spec-Driven Development** — `specs/004-pwa-push-notifications/spec.md` 존재 확인.
- [X] **VI. Documentation as Living Artifact** — 완료 시 project_status.md, docs/architecture.md, docs/database.md, supabase/schema.sql 업데이트.

## Project Structure

### Documentation (this feature)

```text
specs/004-pwa-push-notifications/
├── plan.md              ✅ This file
├── research.md          ✅ Phase 0 output
├── data-model.md        ✅ Phase 1 output
├── quickstart.md        ✅ Phase 1 output
├── contracts/           ✅ Phase 1 output
│   └── push-api.md
└── tasks.md             (Phase 2 — /speckit-tasks)
```

### Source Code Changes

```text
# New files
public/
├── sw.js                          # Service Worker (push + offline)
├── icons/
│   ├── icon-192.png               # PWA 아이콘 192×192
│   └── icon-512.png               # PWA 아이콘 512×512

app/
├── manifest.ts                    # Web App Manifest (Next.js 16 방식)
├── layout.tsx                     # SW 등록 + Apple PWA 메타태그 추가

# Modified files
app/(dashboard)/layout.tsx         # Footer 추가
components/layout/
├── header.tsx                     # RefreshButton 추가
├── refresh-button.tsx             # NEW: router.refresh() 클라이언트 컴포넌트
components/
├── push-notification-banner.tsx   # NEW: 알림 수신 동의 배너
├── footer.tsx                     # NEW: SUWANT holdings Inc. 푸터

app/actions/
├── push.ts                        # NEW: subscribePush, unsubscribePush, sendPushToInstitution

supabase/migrations/
└── 20260517000001_push_subscriptions.sql  # NEW: push_subscriptions 테이블

app/(dashboard)/settings/page.tsx  # 알림 구독 관리 섹션 추가
app/(dashboard)/page.tsx           # PushNotificationBanner 추가
```

## Implementation Notes

### Service Worker (`public/sw.js`)
- `push` 이벤트: JSON payload 파싱 → `self.registration.showNotification()`
- `notificationclick` 이벤트: `clients.openWindow(data.url)`
- fetch 이벤트: 기본 네트워크 우선 (캐시 전략 최소화)
- SW 등록: `app/layout.tsx` 내 `<script>` 또는 클라이언트 컴포넌트에서 `navigator.serviceWorker.register('/sw.js')`

### VAPID 키 생성
```bash
npx web-push generate-vapid-keys
# → .env.local 및 Vercel env에 추가
```

### 푸시 발송 흐름
1. `saveConsultation()` Server Action 완료
2. `sendPushToInstitution(institutionId, payload)` 호출 (await 없이 fire-and-forget)
3. DB에서 해당 기관의 `push_subscriptions` 전체 조회
4. `webpush.sendNotification()` 각 구독에 발송
5. 만료된 구독(`410 Gone`)은 자동 삭제

### Supabase Migration
```sql
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
CREATE INDEX push_subscriptions_institution ON public.push_subscriptions(institution_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- RLS policies: user_id = auth.uid() for SELECT/INSERT/DELETE
-- Service role bypasses RLS for sendPushToInstitution (읽기)
```

### 헤더 새로고침 버튼
`RefreshButton`은 `"use client"` 컴포넌트 — `useRouter().refresh()` 호출. 헤더(Server Component)에 포함.

### 항시 로그인
`@supabase/ssr` 미들웨어(`middleware.ts`)가 이미 쿠키 기반 세션을 자동 갱신함. 별도 구현 불필요 — 기존 `middleware.ts` 확인 후 `supabase.auth.refreshSession()` 명시적 호출이 없으면 `onAuthStateChange` 리스너를 `app/layout.tsx` 클라이언트 컴포넌트에 추가.

## Complexity Tracking

없음 — Constitution 위반 없음.
